import json, logging, os
from datetime import datetime
from sqlalchemy import create_engine, event, Column, Integer, Float, String, Text, DateTime, ForeignKey, func, UniqueConstraint
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

logger = logging.getLogger(__name__)
DATABASE_URL = os.getenv("SQLite_PATH", "./data.sqlite")
MAX_SUBMISSIONS = int(os.getenv("DB_MAX_SUBMISSIONS", "1000"))
engine = create_engine(f"sqlite:///{DATABASE_URL}", connect_args={"check_same_thread": False}, pool_pre_ping=True)


@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA busy_timeout=5000")
    cursor.close()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(128), nullable=False)
    role = Column(String(20), nullable=False)
    name = Column(String(255), nullable=False)
    language = Column(String(50), default="en")
    created_at = Column(DateTime, default=datetime.utcnow)
    badges = relationship("Badge", foreign_keys="Badge.student_id", backref="student_badges", lazy="dynamic")

    def to_dict(self):
        return {"id": self.id, "email": self.email, "role": self.role, "name": self.name,
                "language": self.language,
                "created_at": self.created_at.isoformat() if self.created_at else None}


class Assessment(Base):
    __tablename__ = "assessments"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    question = Column(Text, nullable=False)
    reference_answer = Column(Text, nullable=False)
    max_score = Column(Float, default=100.0)
    deadline = Column(String(50), nullable=True)
    submission_type = Column(String(50), default="text")
    difficulty = Column(String(20), default="medium")
    practice_mode = Column(Integer, default=0)
    timer_sec = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    teacher = relationship("User", foreign_keys=[teacher_id])
    submissions = relationship("Submission", back_populates="assessment", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id, "teacher_id": self.teacher_id, "title": self.title,
            "question": self.question, "reference_answer": self.reference_answer,
            "max_score": self.max_score, "deadline": self.deadline,
            "submission_type": self.submission_type, "difficulty": self.difficulty,
            "practice_mode": self.practice_mode, "timer_sec": self.timer_sec,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "submission_count": len(self.submissions) if self.submissions else 0,
        }


class Submission(Base):
    __tablename__ = "submissions"
    __table_args__ = (UniqueConstraint("assessment_id", "student_id", name="uq_submission_per_student"),)
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    assessment_id = Column(Integer, ForeignKey("assessments.id"), nullable=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    student_name = Column(String(255), nullable=False)
    question_text = Column(Text, nullable=False)
    question_reference = Column(Text, nullable=True)
    answer_type = Column(String(50), nullable=False)
    original_answer = Column(Text, nullable=True)
    extracted_text = Column(Text, nullable=True)
    score = Column(Float, nullable=True)
    feedback = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    assessment = relationship("Assessment", back_populates="submissions")
    student = relationship("User", foreign_keys=[student_id])

    def to_dict(self):
        return {
            "id": self.id, "assessment_id": self.assessment_id, "student_id": self.student_id,
            "student_name": self.student_name, "question_text": self.question_text,
            "question_reference": self.question_reference, "answer_type": self.answer_type,
            "original_answer": self.original_answer, "extracted_text": self.extracted_text,
            "score": self.score, "feedback": self.feedback,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Badge(Base):
    __tablename__ = "badges"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    assessment_id = Column(Integer, ForeignKey("assessments.id"), nullable=True)
    badge_name = Column(String(100), nullable=False)
    badge_icon = Column(String(10), default="\U0001F44D")
    created_at = Column(DateTime, default=datetime.utcnow)


def init_db():
    Base.metadata.create_all(bind=engine)
    _seed_default_users()
    _enforce_limit()
    logger.info("Database ready at %s (max %d rows)", DATABASE_URL, MAX_SUBMISSIONS)


def _seed_default_users():
    from .auth import hash_password
    db = SessionLocal()
    try:
        if not db.query(User).first():
            db.add(User(email="teacher@test.com", password_hash=hash_password("Teacher@123!"), role="teacher", name="Dr. Smith"))
            db.add(User(email="student@test.com", password_hash=hash_password("Student@123!"), role="student", name="Alice"))
            db.commit()
            logger.info("Seeded default users: teacher@test.com / student@test.com")
    finally:
        db.close()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _enforce_limit():
    db = SessionLocal()
    try:
        count = db.query(func.count(Submission.id)).scalar()
        while count > MAX_SUBMISSIONS:
            oldest = db.query(Submission).order_by(Submission.id.asc()).first()
            if oldest:
                db.delete(oldest)
                count -= 1
        db.commit()
    except Exception as exc:
        logger.error("DB limit enforcement failed: %s", exc)
    finally:
        db.close()


def get_stats(db, assessment_id=None) -> dict:
    q = db.query(func.count(Submission.id))
    q2 = db.query(func.avg(Submission.score))
    if assessment_id:
        q = q.filter(Submission.assessment_id == assessment_id)
        q2 = q2.filter(Submission.assessment_id == assessment_id)
    total = q.scalar() or 0
    avg = q2.scalar() or 0.0
    return {"total_submissions": total, "average_score": round(float(avg), 2),
            "estimated_time_saved_hours": round(total * 0.005, 2), "max_capacity": MAX_SUBMISSIONS}


def backup_to_json(db) -> dict:
    return {
        "users": [u.to_dict() for u in db.query(User).order_by(User.id).all()],
        "assessments": [a.to_dict() for a in db.query(Assessment).order_by(Assessment.id).all()],
        "submissions": [s.to_dict() for s in db.query(Submission).order_by(Submission.id).all()],
    }


def clear_all(db) -> int:
    count = db.query(Submission).count()
    db.query(Submission).delete()
    db.query(Assessment).delete()
    db.query(User).delete()
    db.commit()
    logger.info("Cleared all data", count)
    return count
