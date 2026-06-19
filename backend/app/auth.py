import os, logging
import bcrypt
from datetime import datetime, timedelta
from fastapi import Header, HTTPException
import jwt

logger = logging.getLogger(__name__)
SECRET = os.getenv("JWT_SECRET")
ALGO = "HS256"
EXPIRY_HOURS = 24

if not SECRET:
    if os.getenv("GRADESMART_DEV") == "1":
        SECRET = "gradesmart-dev-secret-do-not-use-in-production"
        logger.warning("JWT_SECRET not set, using dev fallback. Set GRADESMART_DEV=0 and JWT_SECRET for production.")
    else:
        raise RuntimeError(
            "JWT_SECRET environment variable is required.\n"
            "  PowerShell: $env:JWT_SECRET='your-32-char-secret'\n"
            "  CMD:        set JWT_SECRET=your-32-char-secret\n"
            "  Or for dev only: $env:GRADESMART_DEV=1\n"
        )

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, pw_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), pw_hash.encode())

def create_token(user_id: int, role: str, email: str) -> str:
    payload = {
        "user_id": user_id, "role": role, "email": email,
        "exp": datetime.utcnow() + timedelta(hours=EXPIRY_HOURS),
        "iat": datetime.utcnow(),
        "iss": "gradesmart-ai",
        "aud": "gradesmart-api",
    }
    return jwt.encode(payload, SECRET, algorithm=ALGO)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET, algorithms=[ALGO], audience="gradesmart-api",
                          options={"require": ["exp", "iat", "aud"]})
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")

def require_role(*roles: str):
    def decorator(auth: str = Header(None, alias="Authorization")):
        if not auth:
            raise HTTPException(401, "Missing Authorization header")
        if auth.startswith("JWT "):
            token = auth[4:]
        elif auth.startswith("Bearer "):
            token = auth[7:]
        else:
            token = auth
        payload = decode_token(token)
        if payload["role"] not in roles:
            raise HTTPException(403, f"Requires role: {', '.join(roles)}")
        return payload
    return decorator
