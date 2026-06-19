import functools, hashlib, logging, os, numpy as np
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)
_model = None

CUSTOM_MODEL_PATH = os.path.join(os.path.dirname(__file__), "custom_model")

def _get_model():
    global _model
    if _model is None:
        model_name = os.getenv("GRADING_MODEL", "custom")
        use_custom = model_name == "custom" and os.path.isdir(CUSTOM_MODEL_PATH)
        path = CUSTOM_MODEL_PATH if use_custom else "sentence-transformers/all-MiniLM-L6-v2"
        _model = SentenceTransformer(path)
        logger.info("Loaded grading model: %s (%s)", path, "fine-tuned" if use_custom else "base")
    return _model

def _make_key(a: str, b: str) -> str:
    return hashlib.md5(f"{a.strip().lower()}|{b.strip().lower()}".encode()).hexdigest()

@functools.lru_cache(maxsize=2048)
def _cached_grade(a: str, b: str) -> float:
    model = _get_model()
    ea = model.encode(a, show_progress_bar=False)
    eb = model.encode(b, show_progress_bar=False)
    norm = np.linalg.norm(ea) * np.linalg.norm(eb)
    if norm == 0:
        return 0.0
    return round(max(0.0, min(100.0, float(np.dot(ea, eb) / norm) * 100.0)), 2)

def grade_answer(student_answer: str, reference_answer: str) -> float:
    if not student_answer.strip() or not reference_answer.strip():
        return 0.0
    return _cached_grade(student_answer.strip(), reference_answer.strip())
