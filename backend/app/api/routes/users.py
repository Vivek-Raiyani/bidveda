import math
import logging
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.models.user import User
from app.core.permissions import UserRoleEnum
from app.schemas.response import DataResponse, MessageResponse, PaginationMeta
from app.schemas.user import (
    UserOut,
    UserUpdate,
    UserUpdatePassword,
    AdminUserCreate,
    AdminUserUpdate,
)
from app.services.user_service import user_service
from app.core.security import verify_password, get_password_hash

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Admin Endpoints (Scoped to UserRoleEnum.ADMIN)
# ---------------------------------------------------------------------------

@router.get("", response_model=DataResponse[List[UserOut]])
@router.get("/", response_model=DataResponse[List[UserOut]], include_in_schema=False)
async def list_users(
    q: Optional[str] = Query(None, description="Search keyword in name or email"),
    role: Optional[UserRoleEnum] = Query(None, description="Filter by user role"),
    email_verified: Optional[bool] = Query(None, description="Filter by email verification status"),
    is_deleted: Optional[bool] = Query(None, description="Filter by soft-deleted/banned status"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Items per page"),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(UserRoleEnum.ADMIN)),
):
    """
    List users with search, role, status filters, and pagination.
    Only accessible by Admins.
    """
    logger.info(f"Admin {current_user.id} listing users (page={page}, limit={limit}, role={role})")
    users, total_items = await user_service.list_users(
        db=db,
        q=q,
        role=role,
        email_verified=email_verified,
        is_deleted=is_deleted,
        page=page,
        limit=limit,
    )

    total_pages = math.ceil(total_items / limit) if total_items > 0 else 0
    pagination = PaginationMeta(
        page=page,
        limit=limit,
        total_pages=total_pages,
        total_items=total_items,
    )

    return DataResponse(data=users, pagination=pagination)


@router.post("", response_model=DataResponse[UserOut], status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=DataResponse[UserOut], status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def create_user_by_admin(
    user_in: AdminUserCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(UserRoleEnum.ADMIN)),
):
    """
    Create a new user with any role directly as an administrator.
    Only accessible by Admins.
    """
    existing_user = await user_service.get_user_by_email(db, user_in.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The user with this email already exists in the system.",
        )

    new_user = await user_service.create_user_by_admin(db, user_in)
    return DataResponse(data=new_user)


# ---------------------------------------------------------------------------
# Authenticated User Profile Endpoints
# ---------------------------------------------------------------------------

@router.get("/profile", response_model=DataResponse[UserOut])
async def get_profile(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    logger.info(f"Fetching profile for user {current_user.id}")
    return DataResponse(data=current_user)


@router.patch("/profile", response_model=DataResponse[UserOut])
async def update_profile(
    user_in: UserUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    logger.info(f"Updating profile for user {current_user.id}")
    if user_in.email and user_in.email != current_user.email:
        existing_user = await user_service.get_user_by_email(db, user_in.email)
        if existing_user:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already taken")

    updated_user = await user_service.update_user(db, current_user, user_in)
    return DataResponse(data=updated_user)


@router.post("/update-password", response_model=MessageResponse)
async def update_password(
    password_in: UserUpdatePassword,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    if not current_user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User authenticated via OAuth does not have a password. Please use OAuth to login.",
        )

    if not verify_password(password_in.current_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Incorrect current password")

    current_user.hashed_password = get_password_hash(password_in.new_password)
    await db.commit()

    return MessageResponse(message="Password updated successfully")


# ---------------------------------------------------------------------------
# Individual User Admin Operations
# ---------------------------------------------------------------------------

@router.get("/{user_id}", response_model=DataResponse[UserOut])
async def get_user_by_id(
    user_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(UserRoleEnum.ADMIN)),
):
    """
    Get user details by ID.
    Only accessible by Admins.
    """
    user = await user_service.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return DataResponse(data=user)


@router.patch("/{user_id}", response_model=DataResponse[UserOut])
async def update_user_by_admin(
    user_id: UUID,
    user_in: AdminUserUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(UserRoleEnum.ADMIN)),
):
    """
    Update a user's details, role, or active status.
    Only accessible by Admins.
    """
    user = await user_service.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Safeguards: Admin cannot demote or deactivate their own active account
    if current_user.id == user.id and user_in.role and user_in.role != UserRoleEnum.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot demote your own admin account",
        )
    if current_user.id == user.id and user_in.is_deleted is True:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own admin account",
        )

    if user_in.email and user_in.email != user.email:
        existing = await user_service.get_user_by_email(db, user_in.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already taken",
            )

    updated_user = await user_service.admin_update_user(db, user, user_in)
    return DataResponse(data=updated_user)


@router.delete("/{user_id}", response_model=DataResponse[UserOut])
async def delete_user_by_admin(
    user_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(UserRoleEnum.ADMIN)),
):
    """
    Soft-delete a user account.
    Only accessible by Admins.
    """
    user = await user_service.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if current_user.id == user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own admin account",
        )

    deleted_user = await user_service.soft_delete_user(db, user)
    return DataResponse(data=deleted_user)


@router.post("/{user_id}/ban", response_model=DataResponse[UserOut])
async def ban_user(
    user_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(UserRoleEnum.ADMIN)),
):
    """
    Ban a user, immediately terminating active access and preventing future logins.
    Only accessible by Admins.
    """
    user = await user_service.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if current_user.id == user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot ban your own admin account",
        )

    banned_user = await user_service.ban_user(db, user)
    return DataResponse(data=banned_user)


@router.post("/{user_id}/unban", response_model=DataResponse[UserOut])
async def unban_user(
    user_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(UserRoleEnum.ADMIN)),
):
    """
    Unban a previously deactivated or banned user.
    Only accessible by Admins.
    """
    user = await user_service.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    unbanned_user = await user_service.unban_user(db, user)
    return DataResponse(data=unbanned_user)

