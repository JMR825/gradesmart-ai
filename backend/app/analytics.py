import logging
from collections import Counter
from sqlalchemy import func
from .models import Submission

logger = logging.getLogger(__name__)

def _filter_q(q, assessment_id=None):
    if assessment_id:
        return q.filter(Submission.assessment_id == assessment_id)
    return q

def compute_score_distribution(db, assessment_id=None):
    q = _filter_q(db.query(Submission.score).filter(Submission.score.isnot(None)), assessment_id)
    scores = [s[0] for s in q.all()]
    if not scores:
        return {"excellent": 0, "good": 0, "average": 0, "poor": 0}
    return {
        "excellent": sum(1 for s in scores if s >= 90),
        "good": sum(1 for s in scores if 70 <= s < 90),
        "average": sum(1 for s in scores if 50 <= s < 70),
        "poor": sum(1 for s in scores if s < 50),
    }

def compute_class_stats(db, assessment_id=None):
    q = _filter_q(db.query(func.avg(Submission.score), func.min(Submission.score),
                            func.max(Submission.score), func.count(Submission.id))
                    .filter(Submission.score.isnot(None)), assessment_id)
    avg, mn, mx, total = q.first()
    return {
        "average_score": round(float(avg), 2) if avg else 0,
        "min_score": round(float(mn), 2) if mn else 0,
        "max_score": round(float(mx), 2) if mx else 0,
        "total_graded": total or 0,
    }

def find_common_mistakes(db, min_count=2, assessment_id=None):
    q = _filter_q(db.query(Submission.original_answer, Submission.question_reference, Submission.score)
                    .filter(Submission.score.isnot(None), Submission.original_answer.isnot(None)),
                    assessment_id)
    subs = q.all()
    low_score = [(s.original_answer, s.question_reference) for s in subs if s.score is not None and s.score < 60]
    if not low_score:
        return []
    answer_groups = Counter()
    concept_map = {}
    for ans, ref in low_score:
        key = ans.strip().lower()[:60]
        answer_groups[key] += 1
        if key not in concept_map:
            concept_map[key] = ref or "Unknown"
    return [
        {"answer": ans[:80], "count": cnt, "concept": concept_map[ans]}
        for ans, cnt in answer_groups.most_common(10) if cnt >= min_count
    ]


def compute_student_history(db, student_id: int) -> list:
    subs = db.query(Submission).filter(Submission.student_id == student_id).order_by(Submission.created_at.asc()).all()
    return [{"date": s.created_at.isoformat() if s.created_at else "", "score": s.score, "title": s.question_text[:50]} for s in subs]


def compute_peer_distribution(db, assessment_id: int) -> dict:
    subs = db.query(Submission).filter(Submission.assessment_id == assessment_id).all()
    scores = [s.score for s in subs if s.score is not None]
    if not scores:
        return {"distribution": [0, 0, 0, 0], "class_avg": 0, "total": 0}
    excellent = sum(1 for s in scores if s >= 90)
    good = sum(1 for s in scores if 70 <= s < 90)
    average = sum(1 for s in scores if 50 <= s < 70)
    poor = sum(1 for s in scores if s < 50)
    return {
        "distribution": [excellent, good, average, poor],
        "class_avg": round(sum(scores) / len(scores), 1),
        "total": len(scores),
    }


def compute_leaderboard(db, assessment_id: int) -> list:
    subs = db.query(Submission).filter(Submission.assessment_id == assessment_id, Submission.score.isnot(None)).order_by(Submission.score.desc()).limit(10).all()
    return [{"name": s.student_name, "score": s.score, "submission_id": s.id} for s in subs]


def compute_trend(submissions: list) -> str:
    if len(submissions) < 2:
        return ""
    recent = [s for s in submissions if s.score is not None]
    if len(recent) < 2:
        return ""
    if recent[-1].score > recent[-2].score:
        return "improving"
    elif recent[-1].score < recent[-2].score:
        return "declining"
    return "stable"
