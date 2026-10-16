from typing import AsyncGenerator
from fastapi import Depends, HTTPException, Request, status
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import ValidationError
import uuid
import logging

logger = logging.getLogger(__name__)

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.user import User
from app.core.permissions import UserRoleEnum, Permission, has_permission

from app.schemas.token import TokenPayload

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as db:
        yield db

def _extract_token_from_cookie(request: Request) -> str:
    """Extract and validate the raw JWT string from the access_token cookie."""
    cookie_value = request.cookies.get("access_token")
    if not cookie_value:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    # Cookie is stored as "Bearer <token>"
    if not cookie_value.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication scheme",
        )
    return cookie_value[len("Bearer "):]

async def get_current_user(
    request: Request, db: AsyncSession = Depends(get_db)
) -> User:
    logger.info("Authenticating user via cookie")
    token = _extract_token_from_cookie(request)
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=["HS256"]
        )
        token_data = TokenPayload(**payload)
    except (JWTError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
    
    try:
        user_uuid = uuid.UUID(token_data.sub)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid token subject format")

    result = await db.execute(select(User).filter(User.id == user_uuid))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_deleted:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is deactivated or banned")
    return user


def require_roles(*allowed_roles: UserRoleEnum):
    """
    Dependency that checks if the current user has any of the specified roles.
    Works even if roles are stored in the DB as the enum value (e.g. "buyer", "admin").
    """
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if str(current_user.role) not in [role.value for role in allowed_roles]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="The user doesn't have enough privileges",
            )
        return current_user
    return role_checker


def require_permission(permission: Permission):
    """Dependency that checks if the current user has the required permission."""
    async def permission_checker(current_user: User = Depends(get_current_user)) -> User:
        try:
            user_role = UserRoleEnum(current_user.role)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid user role"
            )
   
   
        if not has_permission(user_role, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: requires '{permission.value}'",
            )
        return current_user
    return permission_checker


def require_all_permissions(*permissions: Permission):
    """Dependency that checks if the current user has ALL of the specified permissions."""
    async def permission_checker(current_user: User = Depends(get_current_user)) -> User:
        try:
            user_role = UserRoleEnum(current_user.role)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid user role",
            )

        for perm in permissions:
            if not has_permission(user_role, perm):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Permission denied: requires '{perm.value}'",
                )
        return current_user
    return permission_checker


def require_any_permission(*permissions: Permission):
    """Dependency that checks if the current user has AT LEAST ONE of the specified permissions."""
    async def permission_checker(current_user: User = Depends(get_current_user)) -> User:
        try:
            user_role = UserRoleEnum(current_user.role)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid user role",
            )

        if not any(has_permission(user_role, perm) for perm in permissions):
            perm_names = ", ".join(f"'{p.value}'" for p in permissions)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: requires one of [{perm_names}]",
            )
        return current_user
    return permission_checker


