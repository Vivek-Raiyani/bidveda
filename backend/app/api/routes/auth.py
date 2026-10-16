from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from authlib.integrations.starlette_client import OAuth

from app.api import deps
from app.core.config import settings
from app.core.security import (
    create_access_token, verify_password, create_refresh_token,
    create_verification_token, create_reset_password_token, get_password_hash
)
from app.schemas.token import Token, TokenPayload
from app.schemas.user import UserCreate, UserOut, UserLogin
from app.schemas.response import DataResponse, MessageResponse
from app.services import auth_service
from app.models.user import User
from app.core.permissions import UserRoleEnum
from app.utils.emails import email_provider
from jose import jwt, JWTError
from pydantic import BaseModel, EmailStr
import logging
from uuid import UUID
from app.schemas.auth import ForgotPasswordRequest, ResetPasswordRequest

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/signup", response_model=UserOut)
async def signup(
    user_in: UserCreate,
    db: AsyncSession = Depends(deps.get_db)
):
    """
    Create new user without the need to be logged in.
    """
    user = await auth_service.get_user_by_email(db, email=user_in.email)
    logger.info(f"Processing signup request for {user_in.email}")
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system.",
        )
    user = await auth_service.create_user(db, user_in=user_in)
    
    # Send verification email
    # verify_token = create_verification_token(user.email)
    # verify_link = f"{settings.FRONTEND_URL}/verify-email?token={verify_token}"
    # email_html = f"<h3>Welcome to ClickCapturr</h3><p>Please verify your email by clicking the link below:</p><a href='{verify_link}'>Verify Email</a>"
    # await email_provider.send_email(to_email=user.email, subject="Verify your email", html_content=email_html)

    return user

@router.post("/signin", response_model=MessageResponse)
async def signin(
    login_data: UserLogin, response: Response, db: AsyncSession = Depends(deps.get_db)
):
    """
    Authenticates a user and sets HTTP-only cookies for access and refresh tokens.
    The frontend does not need to handle or store tokens manually.
    """
    logger.info(f"Processing signin request for {login_data.email}")
    user = await auth_service.get_user_by_email(db, email=login_data.email)
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    if user.is_deleted:
        raise HTTPException(status_code=400, detail="Account has been deactivated or banned")
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    access_token = create_access_token({"sub": str(user.id), "role": user.role}, expires_delta=access_token_expires)
    refresh_token = create_refresh_token({"sub": str(user.id), "role": user.role})
    
    cookie_samesite = "none" if settings.COOKIE_SECURE else "lax"
    
    # Set access token as HTTP-only cookie (short-lived)
    response.set_cookie(
        key="access_token",
        value=f"Bearer {access_token}",
        httponly=True,
        secure=settings.COOKIE_SECURE,  # True in production (HTTPS)
        samesite=cookie_samesite,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    # Set refresh token as HTTP-only cookie (long-lived)
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=cookie_samesite,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    )
    return MessageResponse(message="Successfully logged in")

@router.get("/me", response_model=UserOut)
async def get_current_user_data(current_user: User = Depends(deps.get_current_user)):
    """
    Get the current user data.
    """
    return current_user

@router.post("/signout", response_model=MessageResponse)
async def signout(response: Response, current_user: User = Depends(deps.get_current_user)):
    """
    Clears the access_token and refresh_token HTTP-only cookies, effectively
    logging out the user. The frontend cannot do this itself since the cookies
    are HTTP-only and inaccessible to JavaScript.
    """
    cookie_samesite = "none" if settings.COOKIE_SECURE else "lax"
    response.delete_cookie(key="access_token", httponly=True, samesite=cookie_samesite)
    response.delete_cookie(key="refresh_token", httponly=True, samesite=cookie_samesite)
    return MessageResponse(message="Successfully logged out.")

@router.post("/refresh", response_model=MessageResponse)
async def refresh_token(
    request: Request, response: Response, db: AsyncSession = Depends(deps.get_db)
):
    """
    Rotates tokens using the refresh_token HTTP-only cookie.
    Issues new access and refresh cookies. No token is exposed in the response body.
    """
    raw_refresh_token = request.cookies.get("refresh_token")
    if not raw_refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token missing")
    
    try:
        payload = jwt.decode(raw_refresh_token, settings.SECRET_KEY, algorithms=["HS256"])
        token_data = TokenPayload(**payload)
        if token_data.type != "refresh":
            raise HTTPException(status_code=400, detail="Invalid token type")
        user_id = UUID(token_data.sub)
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(status_code=403, detail="Could not validate credentials")
    except JWTError:
        raise HTTPException(status_code=403, detail="Could not validate credentials")
    
    user = await auth_service.get_user_by_id(db, user_id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
   
        
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    new_access_token = create_access_token({"sub": str(user.id), "role": user.role}, expires_delta=access_token_expires)
    new_refresh_token = create_refresh_token({"sub": str(user.id), "role": user.role})
    
    cookie_samesite = "none" if settings.COOKIE_SECURE else "lax"

    # Rotate both cookies
    response.set_cookie(
        key="access_token",
        value=f"Bearer {new_access_token}",
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=cookie_samesite,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=cookie_samesite,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    )
    return MessageResponse(message="Tokens refreshed successfully")

@router.get("/verify-email", response_model=MessageResponse)
async def verify_email(token: str, db: AsyncSession = Depends(deps.get_db)):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        if payload.get("type") != "verify_email":
            raise HTTPException(status_code=400, detail="Invalid token type")
        email = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
        
    user = await auth_service.get_user_by_email(db, email=email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.email_verified = True
    db.add(user)
    await db.commit()
    
    return MessageResponse(message="Email successfully verified")

@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(req: ForgotPasswordRequest, db: AsyncSession = Depends(deps.get_db)):
    user = await auth_service.get_user_by_email(db, email=req.email)
    if user:
        reset_token = create_reset_password_token(user.email)
        reset_link = f"{settings.FRONTEND_URL}/reset-password?token={reset_token}"
        email_html = f"<h3>Reset Password</h3><p>Click the link below to reset your password:</p><a href='{reset_link}'>Reset Password</a>"
        await email_provider.send_email(to_email=user.email, subject="Reset your password", html_content=email_html)
        
    # Always return success to prevent email enumeration
    return MessageResponse(message="If your email is registered, a password reset link has been sent.")

@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(req: ResetPasswordRequest, db: AsyncSession = Depends(deps.get_db)):
    try:
        payload = jwt.decode(req.token, settings.SECRET_KEY, algorithms=["HS256"])
        if payload.get("type") != "reset_password":
            raise HTTPException(status_code=400, detail="Invalid token type")
        email = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
        
    user = await auth_service.get_user_by_email(db, email=email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.hashed_password = get_password_hash(req.new_password)
    db.add(user)
    await db.commit()
    
    return MessageResponse(message="Password successfully reset")

