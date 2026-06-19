import logging, os
import pytesseract
from PIL import Image, ImageEnhance, ImageFilter

logger = logging.getLogger(__name__)
MAX_IMAGE_MB = int(os.getenv("MAX_IMAGE_SIZE_MB", "10"))
_MAX_BYTES = MAX_IMAGE_MB * 1024 * 1024

def extract_text_from_image(image_path: str) -> str:
    try:
        img = Image.open(image_path)
    except Exception as exc:
        raise ValueError(f"Invalid image: {exc}") from exc
    size = os.path.getsize(image_path)
    if size > _MAX_BYTES:
        raise ValueError(f"Image too large: {size/1024/1024:.1f}MB (max {MAX_IMAGE_MB}MB)")
    img = img.convert("L")
    img = ImageEnhance.Contrast(img).enhance(2.0)
    img = img.filter(ImageFilter.SHARPEN)
    raw = pytesseract.image_to_string(img, config="--psm 6 --oem 3")
    return " ".join(raw.strip().split())
