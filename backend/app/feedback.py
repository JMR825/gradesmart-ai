import logging, os
import httpx

logger = logging.getLogger(__name__)
_SYSTEM_PROMPT = None
_LLM_TIMEOUT = int(os.getenv("LLM_TIMEOUT", "10"))

def _load_prompt() -> str:
    global _SYSTEM_PROMPT
    if _SYSTEM_PROMPT is None:
        path = os.path.join(os.path.dirname(__file__), "prompts", "feedback_system.txt")
        try:
            with open(path) as f:
                _SYSTEM_PROMPT = f.read()
        except FileNotFoundError:
            _SYSTEM_PROMPT = "Score: {score}/100. Student: {student_ans}. Reference: {reference}. Give encouraging feedback <80 words."
    return _SYSTEM_PROMPT

def generate_feedback(student_answer: str, reference_answer: str, score: float) -> str:
    prompt = _load_prompt().replace("{score}", str(score)).replace("{student_ans}", str(student_answer)).replace("{reference}", str(reference_answer))
    api_url = os.getenv("LLM_API_URL", "")
    api_key = os.getenv("LLM_API_KEY", "")
    if api_url and api_key:
        headers = {"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"}
        payload = {
            "model": os.getenv("LLM_MODEL", "mistralai/Mixtral-8x7B-Instruct-v0.1"),
            "messages": [
                {"role": "system", "content": "You are a helpful teaching assistant."},
                {"role": "user", "content": prompt},
            ],
            "max_tokens": 150, "temperature": 0.7,
        }
        try:
            with httpx.Client(timeout=_LLM_TIMEOUT) as client:
                resp = client.post(api_url, json=payload, headers=headers)
                resp.raise_for_status()
                feedback = resp.json()["choices"][0]["message"]["content"].strip()
                words = feedback.split()
                return " ".join(words[:80]) + "." if len(words) > 80 else feedback
        except Exception as exc:
            safe_msg = str(exc).replace(api_key, "[REDACTED]").replace(api_url.split("://")[-1].split("/")[0] if "://" in api_url else "", "[REDACTED_HOST]")
            logger.warning("LLM failed, using fallback: %s", safe_msg)
    return _fallback_feedback(score)

def _fallback_feedback(score: float) -> str:
    if score >= 90:
        return "Excellent! Your answer shows strong understanding. You've covered the key concepts accurately. Keep it up!"
    if score >= 70:
        return "Good job! You're on the right track. Review the reference for extra details to strengthen your response."
    if score >= 50:
        return "Nice attempt! You have some correct ideas. Focus on being more precise and structuring your answer clearly."
    return "Thanks for trying! Review the core concepts and try explaining them in your own words before checking the reference."
