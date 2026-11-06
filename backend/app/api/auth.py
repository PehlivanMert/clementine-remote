from fastapi import APIRouter, Response, Request, Depends, HTTPException, status
from pydantic import BaseModel
from ..security import verify_password, create_access_token, get_current_user_optional, login_rate_limiter
from ..config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])

class LoginRequest(BaseModel):
    password: str

class LoginResponse(BaseModel):
    status: str
    token: str

@router.post("/login", response_model=LoginResponse)
async def login(req: LoginRequest, request: Request, response: Response):
    client_ip = request.client.host if request.client else "unknown"

    # Check rate limit (max 5 failed attempts per minute)
    if login_rate_limiter.is_rate_limited(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Please wait 60 seconds before trying again.",
            headers={"Retry-After": "60"}
        )

    if not verify_password(req.password, settings.WEB_PASSWORD):
        login_rate_limiter.record_failed_attempt(client_ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password"
        )

    # Login successful - reset failed attempts
    login_rate_limiter.reset(client_ip)

    token = create_access_token({"sub": "remote_user"})
    response.set_cookie(
        key="token",
        value=token,
        httponly=True,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="lax",
        secure=False  # Allow HTTP over local Wi-Fi
    )
    return LoginResponse(status="authenticated", token=token)

@router.get("/status")
async def auth_status(is_authenticated: bool = Depends(get_current_user_optional)):
    return {"authenticated": is_authenticated}

@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(key="token")
    return {"status": "logged_out"}
