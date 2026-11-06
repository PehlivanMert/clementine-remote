import time
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, List
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from .config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security_bearer = HTTPBearer(auto_error=False)

class LoginRateLimiter:
    """In-memory sliding window rate limiter for login attempts."""
    def __init__(self, max_attempts: int = 5, window_seconds: int = 60):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._attempts: Dict[str, List[float]] = {}

    def is_rate_limited(self, ip: str) -> bool:
        now = time.time()
        cutoff = now - self.window_seconds
        # Clean expired attempts
        attempts = [t for t in self._attempts.get(ip, []) if t > cutoff]
        self._attempts[ip] = attempts
        return len(attempts) >= self.max_attempts

    def record_failed_attempt(self, ip: str):
        now = time.time()
        cutoff = now - self.window_seconds
        attempts = [t for t in self._attempts.get(ip, []) if t > cutoff]
        attempts.append(now)
        self._attempts[ip] = attempts

    def reset(self, ip: str):
        if ip in self._attempts:
            del self._attempts[ip]

login_rate_limiter = LoginRateLimiter()

def verify_password(plain_password: str, correct_password: str) -> bool:
    return plain_password == correct_password

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError:
        return None

def verify_token_string(token: Optional[str]) -> bool:
    """Verify raw token string."""
    if not token:
        return False
    return decode_access_token(token) is not None

async def get_current_user_optional(request: Request, auth: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer)) -> bool:
    token = None
    if auth and auth.credentials:
        token = auth.credentials
    elif "token" in request.cookies:
        token = request.cookies.get("token")
    elif "token" in request.query_params:
        token = request.query_params.get("token")

    if not token:
        return False

    return verify_token_string(token)

async def require_auth(request: Request, auth: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer)) -> bool:
    is_authenticated = await get_current_user_optional(request, auth)
    if not is_authenticated:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return True
