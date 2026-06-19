import csv, io, logging, os, re, tempfile, uuid, httpx
from datetime import datetime
from pathlib import Path
from fastapi import FastAPI, File, Form, UploadFile, Depends, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from sqlalchemy.orm import Session
from pydantic import BaseModel
from .models import User, Assessment, Submission, init_db, get_db, get_stats, backup_to_json, clear_all
from .auth import verify_password, create_token, require_role, hash_password
from .grading import grade_answer
from .feedback import generate_feedback
from .ocr import extract_text_from_image
from .analytics import compute_score_distribution, compute_class_stats, find_common_mistakes
from .speech import transcribe_audio as transcribe_audio_fn
from .question_gen import generate_question as generate_question_fn
from .recommender import recommend_study_resources, get_badge

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
logger = logging.getLogger(__name__)

docs_enabled = os.getenv("GRADESMART_DOCS", "0") == "1"
app = FastAPI(title="GradeSmart AI", version="1.0.0", docs_url="/docs" if docs_enabled else None,
              redoc_url="/redoc" if docs_enabled else None)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    logger.error("Unhandled exception: %s\n%s", exc, traceback.format_exc())
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})

app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000", "http://localhost:8000", "https://*.huggingface.co"], allow_credentials=True, allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"], allow_headers=["Authorization", "Content-Type"])

@app.middleware("http")
async def limit_body_size(request: Request, call_next):
    if request.method in ("POST", "PUT"):
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > 10 * 1024 * 1024:
            return JSONResponse(status_code=413, content={"detail": "Request too large (max 10MB)"})
    return await call_next(request)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

STATIC_DIR = Path(__file__).parent.parent / "static"
if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")
    @app.get("/")
    def index():
        return FileResponse(str(STATIC_DIR / "index.html"))
    from starlette.requests import Request as SR
    @app.middleware("http")
    async def spa(request: SR, call_next):
        if request.url.path.startswith("/api/"):
            return await call_next(request)
        resp = await call_next(request)
        if resp.status_code == 404:
            return FileResponse(str(STATIC_DIR / "index.html"))
        return resp

import html as html_module

HTML_RE = re.compile(r"<[^>]+>")
def sanitize(text: str) -> str:
    cleaned = HTML_RE.sub("", text).strip()
    return html_module.escape(cleaned)

def csv_safe(val: str) -> str:
    if val and val[0] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + val
    return val

def validate(value: str, name: str, max_len: int = 5000):
    if not value or not value.strip():
        raise HTTPException(400, f"{name} cannot be empty")
    if len(value) > max_len:
        raise HTTPException(400, f"{name} exceeds {max_len} chars")
    return sanitize(value)

import re as re_module

def validate_email(email: str) -> str:
    email_pattern = re_module.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
    if not email or not email_pattern.match(email):
        raise HTTPException(400, "Invalid email format")
    return email.strip().lower()

# Pydantic models
class LoginRequest(BaseModel):
    email: str
    password: str
    role: str

class SignupRequest(BaseModel):
    email: str
    password: str
    role: str
    name: str

class CreateAssessmentRequest(BaseModel):
    title: str
    question: str
    reference_answer: str
    max_score: float = 100.0
    deadline: str = None
    submission_type: str = "text"
    difficulty: str = "medium"
    practice_mode: bool = False
    timer_sec: int = 0

class AssessmentSubmitRequest(BaseModel):
    answer: str
    answer_type: str = "text"

class BulkItem(BaseModel):
    student_name: str
    answer: str

class BulkUploadRequest(BaseModel):
    assessment_id: int
    items: list[BulkItem]

# Startup
@app.on_event("startup")
def startup():
    init_db()
    logger.info("GradeSmart AI v1.0.0 started")

@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0", "timestamp": datetime.utcnow().isoformat()}

# ─── AUTH ────────────────────────────────────────────────────

@app.post("/api/login")
@limiter.limit("30/minute")
def login(request: Request, req: LoginRequest, db: Session = Depends(get_db)):
    req.email = validate_email(req.email)
    user = db.query(User).filter(User.email == req.email, User.role == req.role).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(401, "Invalid email, password, or role")
    token = create_token(user.id, user.role, user.email)
    return {"token": token, "role": user.role, "name": user.name, "user_id": user.id}

@app.post("/api/signup")
@limiter.limit("10/minute")
def signup(request: Request, req: SignupRequest, db: Session = Depends(get_db)):
    if req.role not in ("student", "teacher"):
        raise HTTPException(400, "Role must be 'student' or 'teacher'")
    if len(req.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    req.email = validate_email(req.email)
    existing = db.query(User).filter(User.email == req.email).first()
    if existing:
        raise HTTPException(400, "Email already registered. If you forgot your password, contact your teacher.")
    user = User(email=req.email, password_hash=hash_password(req.password), role=req.role, name=validate(req.name, "Name", 255))
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_token(user.id, user.role, user.email)
    return {"token": token, "role": user.role, "name": user.name, "user_id": user.id}

@app.get("/api/me")
def get_me(auth_user: dict = Depends(require_role("student", "teacher")), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == auth_user["user_id"]).first()
    if not user:
        raise HTTPException(404)
    return user.to_dict()

class UpdateProfileRequest(BaseModel):
    name: str = None
    email: str = None
    password: str = None
    old_password: str = None

@app.put("/api/me")
@limiter.limit("10/minute")
def update_me(request: Request, req: UpdateProfileRequest, auth_user: dict = Depends(require_role("student", "teacher")),
              db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == auth_user["user_id"]).first()
    if not user:
        raise HTTPException(404)
    if req.name is not None:
        user.name = validate(req.name, "Name", 255)
    if req.email is not None:
        req.email = validate_email(req.email)
        existing = db.query(User).filter(User.email == req.email, User.id != user.id).first()
        if existing:
            raise HTTPException(400, "Email already in use")
        user.email = req.email
    if req.password is not None:
        if not req.old_password or not verify_password(req.old_password, user.password_hash):
            raise HTTPException(400, "Current password is required to set a new password")
        if len(req.password) < 8:
            raise HTTPException(400, "Password must be at least 8 characters")
        user.password_hash = hash_password(req.password)
    db.commit()
    db.refresh(user)
    return user.to_dict()

# ─── TEACHER: ASSESSMENTS ────────────────────────────────────

@app.post("/api/assessments")
def create_assessment(req: CreateAssessmentRequest, auth_user: dict = Depends(require_role("teacher")),
                       db: Session = Depends(get_db)):
    title = validate(req.title, "Title", 255)
    question = validate(req.question, "Question")
    ref = validate(req.reference_answer, "Reference answer")
    if req.deadline:
        try:
            datetime.strptime(req.deadline, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(400, "Deadline must be in YYYY-MM-DD format")
    if req.max_score < 1 or req.max_score > 1000:
        raise HTTPException(400, "max_score must be between 1 and 1000")
    asm = Assessment(teacher_id=auth_user["user_id"], title=title, question=question,
                     reference_answer=ref, max_score=req.max_score, deadline=req.deadline,
                     submission_type=req.submission_type, difficulty=req.difficulty,
                     practice_mode=1 if req.practice_mode else 0, timer_sec=req.timer_sec)
    db.add(asm)
    db.commit()
    db.refresh(asm)
    return asm.to_dict()

@app.get("/api/assessments")
def list_assessments(auth_user: dict = Depends(require_role("teacher", "student")),
                      db: Session = Depends(get_db)):
    asms = db.query(Assessment).order_by(Assessment.id.desc()).all()
    return {"assessments": [a.to_dict() for a in asms]}

@app.get("/api/assessments/{asm_id}")
def get_assessment(asm_id: int, auth_user: dict = Depends(require_role("teacher", "student")),
                    db: Session = Depends(get_db)):
    asm = db.query(Assessment).filter(Assessment.id == asm_id).first()
    if not asm:
        raise HTTPException(404, "Assessment not found")
    return asm.to_dict()

@app.put("/api/assessments/{asm_id}")
def update_assessment(asm_id: int, req: CreateAssessmentRequest,
                       auth_user: dict = Depends(require_role("teacher")), db: Session = Depends(get_db)):
    asm = db.query(Assessment).filter(Assessment.id == asm_id, Assessment.teacher_id == auth_user["user_id"]).first()
    if not asm:
        raise HTTPException(404, "Assessment not found or not yours")
    asm.title = validate(req.title, "Title", 255)
    asm.question = validate(req.question, "Question")
    asm.reference_answer = validate(req.reference_answer, "Reference answer")
    asm.max_score = req.max_score
    asm.deadline = req.deadline
    asm.submission_type = req.submission_type
    db.commit()
    db.refresh(asm)
    return asm.to_dict()

@app.delete("/api/assessments/{asm_id}")
def delete_assessment(asm_id: int, auth_user: dict = Depends(require_role("teacher")),
                       db: Session = Depends(get_db)):
    asm = db.query(Assessment).filter(Assessment.id == asm_id, Assessment.teacher_id == auth_user["user_id"]).first()
    if not asm:
        raise HTTPException(404, "Assessment not found or not yours")
    db.delete(asm)
    db.commit()
    return {"deleted": asm_id}

# ─── TEACHER: MY ASSESSMENTS ─────────────────────────────────

@app.get("/api/teacher/assessments")
def teacher_assessments(auth_user: dict = Depends(require_role("teacher")), db: Session = Depends(get_db)):
    asms = db.query(Assessment).filter(Assessment.teacher_id == auth_user["user_id"]).order_by(Assessment.id.desc()).all()
    return {"assessments": [a.to_dict() for a in asms]}

# ─── STUDENT: SUBMIT ─────────────────────────────────────────

@app.post("/api/assessments/{asm_id}/submit")
@limiter.limit("20/minute")
def submit_to_assessment(request: Request, asm_id: int, req: AssessmentSubmitRequest,
                          auth_user: dict = Depends(require_role("student")), db: Session = Depends(get_db)):
    asm = db.query(Assessment).filter(Assessment.id == asm_id).first()
    if not asm:
        raise HTTPException(404, "Assessment not found")
    if asm.deadline:
        try:
            deadline = datetime.strptime(asm.deadline, "%Y-%m-%d")
            if datetime.utcnow() > deadline:
                raise HTTPException(400, "Submission deadline has passed")
        except ValueError:
            pass
    existing = db.query(Submission).filter(Submission.assessment_id == asm_id, Submission.student_id == auth_user["user_id"]).first()
    if existing:
        raise HTTPException(400, "You already submitted to this assessment")
    ans = validate(req.answer, "Answer")
    score = grade_answer(ans, asm.reference_answer)
    fb = generate_feedback(ans, asm.reference_answer, score)
    if asm.practice_mode:
        fb += f"\n\nCorrect Answer: {asm.reference_answer}"
    user = db.query(User).filter(User.id == auth_user["user_id"]).first()
    sub = Submission(assessment_id=asm_id, student_id=auth_user["user_id"], student_name=user.name,
                     question_text=asm.question, question_reference=asm.reference_answer,
                     answer_type=req.answer_type, original_answer=ans, score=score, feedback=fb)
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return {"id": sub.id, "assessment_id": asm_id, "score": score, "feedback": fb, "assessment_title": asm.title}

@app.post("/api/assessments/{asm_id}/submit-image")
@limiter.limit("10/minute")
async def submit_image_to_assessment(request: Request, asm_id: int, file: UploadFile = File(...),
                                      auth_user: dict = Depends(require_role("student")),
                                      db: Session = Depends(get_db)):
    asm = db.query(Assessment).filter(Assessment.id == asm_id).first()
    if not asm:
        raise HTTPException(404, "Assessment not found")
    if asm.deadline:
        try:
            deadline = datetime.strptime(asm.deadline, "%Y-%m-%d")
            if datetime.utcnow() > deadline:
                raise HTTPException(400, "Submission deadline has passed")
        except ValueError:
            pass
    existing = db.query(Submission).filter(Submission.assessment_id == asm_id, Submission.student_id == auth_user["user_id"]).first()
    if existing:
        raise HTTPException(400, "You already submitted to this assessment")
    if file.content_type not in ("image/jpeg", "image/png", "image/jpg"):
        raise HTTPException(400, "Only JPG/PNG supported")
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(400, "Image exceeds 10MB")
    # Check magic bytes
    magic_bytes = content[:8]
    if not (magic_bytes[:2] == b'\xff\xd8' or magic_bytes[:8] == b'\x89PNG\r\n\x1a\n'):
        raise HTTPException(400, "Invalid image file (not JPEG/PNG)")
    suffix = ".png" if "png" in file.content_type else ".jpg"
    path = os.path.join(tempfile.gettempdir(), f"{uuid.uuid4()}{suffix}")
    try:
        with open(path, "wb") as f:
            f.write(content)
        extracted = extract_text_from_image(path)
    except ValueError as e:
        raise HTTPException(400, str(e))
    finally:
        if os.path.exists(path):
            os.remove(path)
    if not extracted.strip():
        raise HTTPException(400, "No text extracted")
    score = grade_answer(extracted, asm.reference_answer)
    fb = generate_feedback(extracted, asm.reference_answer, score)
    if asm.practice_mode:
        fb += f"\n\nCorrect Answer: {asm.reference_answer}"
    user = db.query(User).filter(User.id == auth_user["user_id"]).first()
    sub = Submission(assessment_id=asm_id, student_id=auth_user["user_id"], student_name=user.name,
                     question_text=asm.question, question_reference=asm.reference_answer,
                     answer_type="image", original_answer=f"[Image: {sanitize(file.filename)}]",
                     extracted_text=extracted, score=score, feedback=fb)
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return {"id": sub.id, "assessment_id": asm_id, "extracted_text": extracted, "score": score, "feedback": fb}


@app.post("/api/assessments/{asm_id}/submit-audio")
@limiter.limit("10/minute")
async def submit_audio_to_assessment(request: Request, asm_id: int,
                                      file: UploadFile = File(...),
                                      auth_user: dict = Depends(require_role("student")),
                                      db: Session = Depends(get_db)):
    asm = db.query(Assessment).filter(Assessment.id == asm_id).first()
    if not asm:
        raise HTTPException(404, "Assessment not found")
    if asm.deadline:
        try:
            deadline = datetime.strptime(asm.deadline, "%Y-%m-%d")
            if datetime.utcnow() > deadline:
                raise HTTPException(400, "Submission deadline has passed")
        except ValueError:
            pass
    existing = db.query(Submission).filter(Submission.assessment_id == asm_id, Submission.student_id == auth_user["user_id"]).first()
    if existing:
        raise HTTPException(400, "You already submitted to this assessment")
    if not file.content_type or not file.content_type.startswith("audio/"):
        raise HTTPException(400, "Only audio files supported")
    content = await file.read()
    if len(content) > 25 * 1024 * 1024:
        raise HTTPException(400, "Audio exceeds 25MB")
    try:
        transcribed = await transcribe_audio_fn(content)
    except ValueError as e:
        raise HTTPException(400, str(e))
    ans = validate(transcribed, "Transcribed answer")
    score = grade_answer(ans, asm.reference_answer)
    fb = generate_feedback(ans, asm.reference_answer, score)
    if asm.practice_mode:
        fb += f"\n\nCorrect Answer: {asm.reference_answer}"
    user = db.query(User).filter(User.id == auth_user["user_id"]).first()
    sub = Submission(assessment_id=asm_id, student_id=auth_user["user_id"], student_name=user.name,
                     question_text=asm.question, question_reference=asm.reference_answer,
                     answer_type="audio", original_answer=f"[Audio: {sanitize(file.filename)}]",
                     extracted_text=transcribed, score=score, feedback=fb)
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return {"id": sub.id, "assessment_id": asm_id, "transcribed_text": transcribed, "score": score, "feedback": fb}


# ─── STUDENT: VIEW RESULTS ───────────────────────────────────

@app.get("/api/student/submissions")
def student_submissions(auth_user: dict = Depends(require_role("student")), db: Session = Depends(get_db)):
    subs = db.query(Submission).filter(Submission.student_id == auth_user["user_id"]).order_by(Submission.id.desc()).all()
    return {"submissions": [s.to_dict() for s in subs]}

@app.get("/api/student/assessments")
def student_assessments(auth_user: dict = Depends(require_role("student")), db: Session = Depends(get_db)):
    asms = db.query(Assessment).order_by(Assessment.id.desc()).all()
    submitted_ids = {s.assessment_id for s in db.query(Submission).filter(Submission.student_id == auth_user["user_id"]).all()}
    result = []
    for a in asms:
        d = a.to_dict()
        d["submitted"] = a.id in submitted_ids
        result.append(d)
    return {"assessments": result}

# ─── STUDENT: HISTORY & ANALYTICS ─────────────────────────────

@app.get("/api/student/history")
def student_history(auth_user: dict = Depends(require_role("student")), db: Session = Depends(get_db)):
    subs = db.query(Submission).filter(Submission.student_id == auth_user["user_id"]).order_by(Submission.created_at.asc()).all()
    from .analytics import compute_trend
    trend = compute_trend(subs)
    history = [{"date": s.created_at.isoformat() if s.created_at else "", "score": s.score, "title": s.question_text[:50]} for s in subs]
    return {"history": history, "trend": trend}


@app.get("/api/assessments/{asm_id}/peer")
def peer_comparison(asm_id: int, auth_user: dict = Depends(require_role("student")), db: Session = Depends(get_db)):
    asm = db.query(Assessment).filter(Assessment.id == asm_id).first()
    if not asm:
        raise HTTPException(404)
    from .analytics import compute_peer_distribution
    dist = compute_peer_distribution(db, asm_id)
    my_sub = db.query(Submission).filter(Submission.assessment_id == asm_id, Submission.student_id == auth_user["user_id"]).first()
    my_score = my_sub.score if my_sub else 0
    all_scores = [s.score for s in db.query(Submission).filter(Submission.assessment_id == asm_id, Submission.score.isnot(None)).all()]
    better = sum(1 for s in all_scores if s < my_score)
    percentile = round(better / len(all_scores) * 100) if all_scores else 0
    return {"my_score": my_score, "percentile": percentile, **dist}


@app.get("/api/assessments/{asm_id}/leaderboard")
def leaderboard(asm_id: int, auth_user: dict = Depends(require_role("teacher")), db: Session = Depends(get_db)):
    asm = db.query(Assessment).filter(Assessment.id == asm_id, Assessment.teacher_id == auth_user["user_id"]).first()
    if not asm:
        raise HTTPException(404)
    from .analytics import compute_leaderboard
    from .recommender import get_badge
    top = compute_leaderboard(db, asm_id)
    results = []
    for i, item in enumerate(top, 1):
        badge = get_badge(item["score"])
        prev = db.query(Submission).filter(Submission.student_name == item["name"], Submission.id != item["submission_id"]).order_by(Submission.id.desc()).first()
        prev_score = prev.score if prev else None
        badge = get_badge(item["score"], prev_score)
        results.append({"rank": i, "name": item["name"], "score": item["score"], "badge": badge})
    return {"leaderboard": results}


@app.post("/api/generate-question")
@limiter.limit("20/minute")
async def generate_question(request: Request, data: dict, auth_user: dict = Depends(require_role("teacher"))):
    topic = data.get("topic", "")
    difficulty = data.get("difficulty", "medium")
    if not topic.strip():
        raise HTTPException(400, "Topic is required")
    result = await generate_question_fn(topic, difficulty)
    return result


@app.post("/api/recommend")
@limiter.limit("20/minute")
async def recommend(request: Request, data: dict, auth_user: dict = Depends(require_role("student"))):
    score = data.get("score", 0)
    mistakes = data.get("mistakes", [])
    topic = data.get("topic", "")
    resources = await recommend_study_resources(score, mistakes, topic)
    return {"recommendations": resources}


# ─── TEACHER: SUBMISSIONS ────────────────────────────────────

@app.get("/api/teacher/submissions")
def teacher_submissions(assessment_id: int = Query(None), page: int = Query(1, ge=1), per_page: int = Query(200, ge=1, le=500),
                         auth_user: dict = Depends(require_role("teacher")), db: Session = Depends(get_db)):
    q = db.query(Submission).join(Assessment).filter(Assessment.teacher_id == auth_user["user_id"])
    if assessment_id:
        q = q.filter(Submission.assessment_id == assessment_id)
    total = q.count()
    subs = q.order_by(Submission.id.desc()).offset((page - 1) * per_page).limit(per_page).all()
    return {"total": total, "page": page, "per_page": per_page,
            "pages": max(1, (total + per_page - 1) // per_page),
            "submissions": [s.to_dict() for s in subs]}

@app.put("/api/submissions/{sub_id}")
def update_submission(sub_id: int, data: dict, auth_user: dict = Depends(require_role("teacher")),
                       db: Session = Depends(get_db)):
    sub = db.query(Submission).join(Assessment).filter(Submission.id == sub_id, Assessment.teacher_id == auth_user["user_id"]).first()
    if not sub:
        raise HTTPException(404, "Not found")
    if "score" in data:
        try:
            sub.score = float(data["score"])
        except (ValueError, TypeError):
            raise HTTPException(400, "Score must be a number")
        import math
        if math.isnan(sub.score) or math.isinf(sub.score) or sub.score < 0 or sub.score > 1000:
            raise HTTPException(400, "Score must be between 0 and 1000")
    if "feedback" in data:
        sub.feedback = sanitize(str(data["feedback"]))
    db.commit()
    db.refresh(sub)
    return sub.to_dict()

# ─── TEACHER: BULK UPLOAD ────────────────────────────────────

@app.post("/api/bulk-upload")
@limiter.limit("10/minute")
def bulk_upload(request: Request, req: BulkUploadRequest, auth_user: dict = Depends(require_role("teacher")),
                 db: Session = Depends(get_db)):
    asm = db.query(Assessment).filter(Assessment.id == req.assessment_id, Assessment.teacher_id == auth_user["user_id"]).first()
    if not asm:
        raise HTTPException(404, "Assessment not found or not yours")
    if len(req.items) > 500:
        raise HTTPException(400, "Max 500 items")
    results, errors = [], []
    for i, item in enumerate(req.items):
        try:
            sn = validate(item.student_name, f"Item {i} name", 255)
            ans = validate(item.answer, f"Item {i} answer")
            # Find or create student user
            student = db.query(User).filter(User.name == sn, User.role == "student").first()
            if not student:
                errors.append({"index": i, "error": f"Student '{sn}' not found"})
                continue
            score = grade_answer(ans, asm.reference_answer)
            fb = generate_feedback(ans, asm.reference_answer, score)
            sub = Submission(assessment_id=asm.id, student_id=student.id, student_name=sn, question_text=asm.question,
                             question_reference=asm.reference_answer, answer_type="text",
                             original_answer=ans, score=score, feedback=fb)
            db.add(sub)
            db.flush()
            results.append({"id": sub.id, "score": score, "student": sn})
        except HTTPException as e:
            errors.append({"index": i, "error": e.detail})
        except Exception as e:
            errors.append({"index": i, "error": str(e)})
    db.commit()
    return {"processed": len(results), "errors": errors, "results": results}

# ─── TEACHER: EXPORT ─────────────────────────────────────────

@app.get("/api/export")
def export_csv(assessment_id: int = Query(...), auth_user: dict = Depends(require_role("teacher")),
                db: Session = Depends(get_db)):
    q = db.query(Submission).join(Assessment).filter(
        Assessment.id == assessment_id, Assessment.teacher_id == auth_user["user_id"])
    subs = q.order_by(Submission.id).all()
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow(["ID", "Student Name", "Answer", "Score", "Feedback"])
    for s in subs:
        w.writerow([s.id, csv_safe(s.student_name or ""), csv_safe(s.original_answer or s.extracted_text or ""), s.score or "", csv_safe(s.feedback or "")])
    out.seek(0)
    return StreamingResponse(iter([out.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": f"attachment; filename=assessment_{assessment_id}_results.csv"})

# ─── STATS & SUGGESTIONS ────────────────────────────────────

@app.get("/api/assessments/{asm_id}/stats")
def assessment_stats(asm_id: int, auth_user: dict = Depends(require_role("teacher")), db: Session = Depends(get_db)):
    asm = db.query(Assessment).filter(Assessment.id == asm_id, Assessment.teacher_id == auth_user["user_id"]).first()
    if not asm:
        raise HTTPException(404)
    class_stats = compute_class_stats(db, asm_id)
    distribution = compute_score_distribution(db, asm_id)
    return {**class_stats, **distribution}

@app.get("/api/assessments/{asm_id}/suggestions")
def assessment_suggestions(asm_id: int, auth_user: dict = Depends(require_role("teacher")), db: Session = Depends(get_db)):
    asm = db.query(Assessment).filter(Assessment.id == asm_id, Assessment.teacher_id == auth_user["user_id"]).first()
    if not asm:
        raise HTTPException(404)
    mistakes = find_common_mistakes(db, assessment_id=asm_id)
    return {"common_mistakes": mistakes}

# ─── BACKUP / CLEAR ──────────────────────────────────────────

@app.get("/api/backup")
def backup(auth_user: dict = Depends(require_role("teacher")), db: Session = Depends(get_db)):
    data = backup_to_json(db)
    for user in data.get("users", []):
        user.pop("password_hash", None)
    return {"backup": data}

@limiter.limit("2/minute")
@app.delete("/api/clear-all")
def clear(request: Request, auth_user: dict = Depends(require_role("teacher")), db: Session = Depends(get_db)):
    logger.warning("CLEAR ALL by user %s (%s)", auth_user["user_id"], auth_user["email"])
    c = clear_all(db)
    _seed_default_users_on_clear()
    return {"deleted": c, "message": "All data cleared"}

def _seed_default_users_on_clear():
    from .models import _seed_default_users
    _seed_default_users()
