import logging, os, tempfile, uuid
import httpx

logger = logging.getLogger(__name__)

WHISPER_API_URL = os.getenv("WHISPER_API_URL", "https://api-inference.huggingface.co/models/openai/whisper-small")
HF_API_TOKEN = os.getenv("HF_API_TOKEN", "")

async def transcribe_audio(audio_bytes: bytes) -> str:
    if not HF_API_TOKEN:
        raise ValueError("HF_API_TOKEN environment variable not set")
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                WHISPER_API_URL,
                headers={"Authorization": f"Bearer {HF_API_TOKEN}"},
                content=audio_bytes,
            )
            resp.raise_for_status()
            result = resp.json()
            text = result.get("text", "")
            if not text.strip():
                raise ValueError("No speech detected in audio")
            return text.strip()
    except httpx.TimeoutException:
        raise ValueError("Whisper API timed out")
    except Exception as exc:
        safe_msg = str(exc).replace(HF_API_TOKEN, "[REDACTED]") if HF_API_TOKEN else str(exc)
        logger.warning("Whisper API failed: %s", safe_msg)
        raise ValueError("Audio transcription failed")
