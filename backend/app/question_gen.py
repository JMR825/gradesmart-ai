import logging, os, json
import httpx

logger = logging.getLogger(__name__)

_LLM_API_URL = os.getenv("LLM_API_URL", "")
_LLM_API_KEY = os.getenv("LLM_API_KEY", "")
_SYSTEM_PROMPT = None

def _load_prompt() -> str:
    global _SYSTEM_PROMPT
    if _SYSTEM_PROMPT is None:
        path = os.path.join(os.path.dirname(__file__), "prompts", "question_gen_system.txt")
        try:
            with open(path) as f:
                _SYSTEM_PROMPT = f.read()
        except FileNotFoundError:
            _SYSTEM_PROMPT = "You are a quiz question generator. Given a topic and difficulty level, generate a single question with a reference answer. Output ONLY valid JSON: {\"question\": \"...\", \"reference_answer\": \"...\"}"
    return _SYSTEM_PROMPT

async def generate_question(topic: str, difficulty: str = "medium") -> dict:
    if not _LLM_API_URL or not _LLM_API_KEY:
        return _fallback_question(topic, difficulty)
    prompt = f"Topic: {topic}\nDifficulty: {difficulty}"
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
                    "max_tokens": 300, "temperature": 0.7,
                },
                headers={"Content-Type": "application/json", "Authorization": f"Bearer {_LLM_API_KEY}"},
            )
            resp.raise_for_status()
            text = resp.json()["choices"][0]["message"]["content"].strip()
            if text.startswith("```json"):
                text = text[7:]
            if text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]
            result = json.loads(text.strip())
            return {"question": result.get("question", ""), "reference_answer": result.get("reference_answer", "")}
    except Exception as exc:
        logger.warning("Question gen LLM failed: %s", exc)
        return _fallback_question(topic, difficulty)

def _fallback_question(topic: str, difficulty: str) -> dict:
    templates = {
        "easy": {"question": f"What is {topic}?", "reference_answer": f"{topic} is a key concept in this subject."},
        "medium": {"question": f"Explain how {topic} works and provide an example.", "reference_answer": f"{topic} involves several key principles. For example..."},
        "hard": {"question": f"Analyze the impact of {topic} on the field and predict future developments.", "reference_answer": f"{topic} has significantly influenced..."},
    }
    return templates.get(difficulty, templates["medium"])
