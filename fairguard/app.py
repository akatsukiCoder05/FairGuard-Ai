from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request, Depends
from fastapi.responses import FileResponse, HTMLResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import os, shutil, json, uuid
from datetime import datetime, timedelta
import uvicorn
# Auth dependencies
from sqlalchemy import create_engine, Column, String, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from passlib.context import CryptContext
from jose import JWTError, jwt
from pydantic import BaseModel
from .bias_detector import FairGuardEngine
from .report_generator import generate_pdf_report

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
STATIC_DIR = os.path.join(BASE_DIR, "static")
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
REPORTS_DIR = os.path.join(BASE_DIR, "reports")

# ── DATABASE ──────────────────────────────────────────────────────────────────
SECRET_KEY  = os.getenv("SECRET_KEY", "fairguard-secret-key-change-in-production")
ALGORITHM   = "HS256"
TOKEN_HOURS = 24

_engine      = create_engine("sqlite:///./fairguard.db", connect_args={"check_same_thread": False})
_SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)
_Base         = declarative_base()

class _User(_Base):
    __tablename__ = "users"
    id              = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name            = Column(String, nullable=False)
    email           = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    created_at      = Column(DateTime, default=datetime.utcnow)

_Base.metadata.create_all(bind=_engine)
_pwd = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
def _get_db():
    db = _SessionLocal()
    try: yield db
    finally: db.close()

def _make_token(email: str, name: str) -> str:
    exp = datetime.utcnow() + timedelta(hours=TOKEN_HOURS)
    return jwt.encode({"sub": email, "name": name, "exp": exp}, SECRET_KEY, algorithm=ALGORITHM)

def _get_user(request: Request, db: Session = Depends(_get_db)) -> _User:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(auth.split(" ", 1)[1], SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(401, "Invalid or expired token")
    user = db.query(_User).filter(_User.email == payload["sub"]).first()
    if not user: raise HTTPException(401, "User not found")
    return user

class _RegBody(BaseModel):
    name: str; email: str; password: str

class _LoginBody(BaseModel):
    email: str; password: str

app = FastAPI(title="FairGuard AI", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
os.makedirs(STATIC_DIR, exist_ok=True)
os.makedirs(UPLOADS_DIR, exist_ok=True)
os.makedirs(REPORTS_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# In-memory session store (for hackathon simplicity)
sessions = {}


# ─────────────────────────────────────────────────
# SERVE FRONTEND
# ─────────────────────────────────────────────────
@app.get("/")
async def root():
    """Root: always show login page"""
    path = os.path.join(TEMPLATES_DIR, "login.html")
    if not os.path.exists(path):
        return HTMLResponse("<h2>Put login.html in templates/ folder</h2>", 404)
    with open(path, "r", encoding="utf-8") as f:
        return HTMLResponse(f.read())

@app.get("/dashboard", response_class=HTMLResponse)
async def serve_dashboard():
    """Dashboard: served after login (auth checked client-side + /auth/me)"""
    path = os.path.join(TEMPLATES_DIR, "index.html")
    if not os.path.exists(path):
        return HTMLResponse("<h2>Put index.html in templates/ folder</h2>", 404)
    with open(path, "r", encoding="utf-8") as f:
        return HTMLResponse(f.read())

# ── AUTH ROUTES ───────────────────────────────────────────────────────────────
@app.post("/auth/register")
def auth_register(body: _RegBody, db: Session = Depends(_get_db)):
    name = body.name.strip()
    email = body.email.lower().strip()
    password = body.password or ""

    if not name or not email or not password:
        raise HTTPException(status_code=400, detail="All fields are required")

    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    if len(password) > 128:
        raise HTTPException(status_code=400, detail="Password must be at most 128 characters")

    if "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email address")

    existing_user = db.query(_User).filter(_User.email == email).first()
    if existing_user:
        raise HTTPException(status_code=409, detail="Email already registered")

    try:
        hashed_password = _pwd.hash(password)
    except Exception:
        raise HTTPException(status_code=500, detail="Password hashing failed")

    user = _User(
        name=name,
        email=email,
        hashed_password=hashed_password
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "token": _make_token(user.email, user.name),
        "name": user.name,
        "email": user.email
    }

@app.post("/auth/login")
def auth_login(body: _LoginBody, db: Session = Depends(_get_db)):
    email = body.email.lower().strip()
    password = body.password or ""

    user = db.query(_User).filter(_User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    try:
        password_ok = _pwd.verify(password, user.hashed_password)
    except Exception:
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    if not password_ok:
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    return {
        "token": _make_token(user.email, user.name),
        "name": user.name,
        "email": user.email
    }

@app.get("/auth/me")
def auth_me(current_user: _User = Depends(_get_user)):
    return {"id": current_user.id, "name": current_user.name, "email": current_user.email}


# ─────────────────────────────────────────────────
# 1. UPLOAD DATASET
# ─────────────────────────────────────────────────
@app.post("/api/upload")
async def upload_dataset(file: UploadFile = File(...)):
    try:
        session_id = str(uuid.uuid4())
        ext = os.path.splitext(file.filename)[-1]
        filepath = os.path.join(UPLOADS_DIR, f"{session_id}{ext}")

        with open(filepath, "wb") as f:
            shutil.copyfileobj(file.file, f)

        engine = FairGuardEngine()
        result = engine.load_dataset(filepath)

        if result.get("status") == "error":
            raise HTTPException(status_code=400, detail=result["message"])

        sessions[session_id] = {"engine": engine, "filepath": filepath}

        return {
            "session_id": session_id,
            "filename": file.filename,
            **result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────
# 2. PREPROCESS
# ─────────────────────────────────────────────────
@app.post("/api/preprocess")
async def preprocess(
    session_id: str = Form(...),
    target_col: str = Form(...),
    sensitive_col: str = Form(...)
):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found. Upload dataset first.")

    engine = sessions[session_id]["engine"]
    result = engine.preprocess(target_col, sensitive_col)
    sessions[session_id]["preprocess"] = {
        "target_col": target_col,
        "sensitive_col": sensitive_col
    }
    return result


# ─────────────────────────────────────────────────
# 3. TRAIN ORIGINAL MODEL
# ─────────────────────────────────────────────────
@app.post("/api/train")
async def train_model(session_id: str = Form(...)):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found.")

    engine = sessions[session_id]["engine"]
    result = engine.train_original_model()
    sessions[session_id]["original_model"] = result
    return result


# ─────────────────────────────────────────────────
# 4. DETECT BIAS
# ─────────────────────────────────────────────────
@app.post("/api/detect-bias")
async def detect_bias(session_id: str = Form(...)):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found.")

    engine = sessions[session_id]["engine"]
    result = engine.detect_bias()
    sessions[session_id]["bias_report"] = result
    return result


# ─────────────────────────────────────────────────
# 5. MITIGATE BIAS
# ─────────────────────────────────────────────────
@app.post("/api/mitigate")
async def mitigate_bias(
    session_id: str = Form(...),
    method: str = Form("reductions")
):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found.")

    engine = sessions[session_id]["engine"]
    result = engine.mitigate_bias(method=method)
    sessions[session_id]["fair_report"] = result
    return result


# ─────────────────────────────────────────────────
# 6. SHAP EXPLAINABILITY
# ─────────────────────────────────────────────────
@app.post("/api/explain")
async def explain(session_id: str = Form(...)):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found.")

    engine = sessions[session_id]["engine"]
    result = engine.explain_model()
    sessions[session_id]["shap"] = result
    return result


# ─────────────────────────────────────────────────
# 7. COMPARISON
# ─────────────────────────────────────────────────
@app.post("/api/compare")
async def compare(session_id: str = Form(...)):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found.")

    engine = sessions[session_id]["engine"]
    result = engine.get_comparison()
    sessions[session_id]["comparison"] = result
    return result


# ─────────────────────────────────────────────────
# 8. GENERATE PDF REPORT
# ─────────────────────────────────────────────────
@app.post("/api/report")
async def generate_report(session_id: str = Form(...)):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found.")

    sess = sessions[session_id]
    engine = sess["engine"]

    # Build comparison if not done
    comparison = sess.get("comparison") or engine.get_comparison()

    # Dataset info from engine
    dataset_info = {
        "rows": engine.df.shape[0] if engine.df is not None else 0,
        "columns": engine.df.shape[1] if engine.df is not None else 0,
    }

    preprocess_info = sess.get("preprocess", {
        "target_col": engine.target_col,
        "sensitive_col": engine.sensitive_col
    })

    pdf_path = os.path.join(REPORTS_DIR, f"fairguard_report_{session_id[:8]}.pdf")
    generate_pdf_report(
        dataset_info=dataset_info,
        preprocess_info=preprocess_info,
        original_model_info=sess.get("original_model", {}),
        bias_report=sess.get("bias_report", {}),
        fair_report=sess.get("fair_report", {}),
        comparison=comparison,
        shap_info=sess.get("shap", {}),
        output_path=pdf_path
    )

    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename="FairGuard_Audit_Report.pdf"
    )

@app.post("/api/download-fixed-dataset")
async def download_fixed_dataset(
    session_id: str = Form(...),
    sensitive_col: str = Form(...)
):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found.")

    engine = sessions[session_id]["engine"]
    if engine.df is None:
        raise HTTPException(status_code=400, detail="Dataset not loaded.")

    df_fixed = engine.df.drop(columns=[sensitive_col], errors="ignore")
    output = df_fixed.to_csv(index=False)

    return Response(
        content=output,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=fixed_dataset.csv"}
    )

# ─────────────────────────────────────────────────
# 9. FULL PIPELINE (ONE CLICK)
# ─────────────────────────────────────────────────
@app.post("/api/full-pipeline")
async def full_pipeline(
    session_id: str = Form(...),
    target_col: str = Form(...),
    sensitive_col: str = Form(...),
    mitigation_method: str = Form("reductions")
):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found.")

    engine = sessions[session_id]["engine"]

    preprocess_result = engine.preprocess(target_col, sensitive_col)
    original_model = engine.train_original_model()
    bias_report = engine.detect_bias()
    fair_report = engine.mitigate_bias(method=mitigation_method)
    shap_result = engine.explain_model()
    comparison = engine.get_comparison()

    sessions[session_id].update({
        "preprocess": {"target_col": target_col, "sensitive_col": sensitive_col},
        "original_model": original_model,
        "bias_report": bias_report,
        "fair_report": fair_report,
        "shap": shap_result,
        "comparison": comparison
    })

    return {
        "preprocess": preprocess_result,
        "original_model": original_model,
        "bias_report": bias_report,
        "fair_report": fair_report,
        "shap": shap_result,
        "comparison": comparison
    }


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)