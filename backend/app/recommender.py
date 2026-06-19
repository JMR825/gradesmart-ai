import logging, os, json
import httpx

logger = logging.getLogger(__name__)

_LLM_API_URL = os.getenv("LLM_API_URL", "")
_LLM_API_KEY = os.getenv("LLM_API_KEY", "")
_SYSTEM_PROMPT = None

def _load_prompt() -> str:
    global _SYSTEM_PROMPT
    if _SYSTEM_PROMPT is None:
        path = os.path.join(os.path.dirname(__file__), "prompts", "recommender_system.txt")
        try:
            with open(path) as f:
                _SYSTEM_PROMPT = f.read()
        except FileNotFoundError:
            _SYSTEM_PROMPT = "You are a study advisor AI. Given a student's score and mistakes, recommend 2-3 specific study resources."
    return _SYSTEM_PROMPT

async def recommend_study_resources(score: float, mistakes: list, topic: str = "") -> list:
    if not _LLM_API_URL or not _LLM_API_KEY:
        return _fallback_recommendations(score)
    mistakes_text = "; ".join(mistakes[:5]) if mistakes else "No specific mistakes identified"
    prompt = f"Student scored {score:.0f}% on '{topic or 'a topic'}'. Mistakes: {mistakes_text}."
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                _LLM_API_URL,
                json={
                    "model": os.getenv("LLM_MODEL", "mistralai/Mixtral-8x7B-Instruct-v0.1"),
                    "messages": [
                        {"role": "system", "content": _load_prompt()},
                        {"role": "user", "content": prompt},
                    ],
                    "max_tokens": 200, "temperature": 0.7,
                },
                headers={"Content-Type": "application/json", "Authorization": f"Bearer {_LLM_API_KEY}"},
            )
            resp.raise_for_status()
            text = resp.json()["choices"][0]["message"]["content"].strip()
            if "[" in text:
                text = text[text.index("["):text.rindex("]")+1]
            return json.loads(text) if text.startswith("[") else _fallback_recommendations(score)
    except Exception as exc:
        logger.warning("Recommender failed: %s", exc)
        return _fallback_recommendations(score)

def _fallback_recommendations(score: float) -> list:
    if score < 50:
        return ["Review the core concepts from your textbook chapter 1-3", "Watch introductory video tutorials on the topic", "Practice with 5 basic problems to build foundation"]
    elif score < 70:
        return ["Focus on understanding key examples in your notes", "Try intermediate practice problems", "Discuss confusing concepts with classmates"]
    else:
        return ["Challenge yourself with advanced problems", "Explore supplementary readings on the topic", "Teach the concept to someone else to solidify understanding"]

def get_badge(score: float, prev_score: float = None) -> dict:
    if score >= 90:
        return {"name": "Excellent!", "icon": "\U0001F3C6", "color": "text-yellow-600"}
    if prev_score and score >= prev_score + 10:
        return {"name": "Improving!", "icon": "\U0001F680", "color": "text-green-600"}
    if score >= 70:
        return {"name": "Good Job!", "icon": "\U0001F44D", "color": "text-blue-600"}
    return {"name": "Keep Trying!", "icon": "\U0001F4AA", "color": "text-orange-600"}
