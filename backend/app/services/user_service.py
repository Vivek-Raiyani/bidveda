from datetime import datetime, timezone
import uuid
from uuid import UUID
from typing import Optional, List, Tuple
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from app.models.user import User
from app.schemas.user import UserUpdate, AdminUserCreate, AdminUserUpdate
from app.core.permissions import UserRoleEnum
from app.core.security import get_password_hash

logger = logging.getLogger(__name__)


class UserService:
    async def get_user_by_id(self, db: AsyncSession, user_id: UUID) -> Optional[User]:
        stmt = select(User).where(User.id == user_id)
        result = await db.execute(stmt)
        return result.scalars().first()

    async def get_user_by_email(self, db: AsyncSession, email: str) -> Optional[User]:
        stmt = select(User).where(User.email == email)
        result = await db.execute(stmt)
        return result.scalars().first()

    async def update_user(self, db: AsyncSession, user: User, user_in: UserUpdate) -> User:
        logger.info(f"Updating user: {user.id}")
        update_data = user_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(user, field, value)
        
        await db.commit()
        await db.refresh(user)
        return user

    async def list_users(
        self,
        db: AsyncSession,
        q: Optional[str] = None,
        role: Optional[UserRoleEnum] = None,
        email_verified: Optional[bool] = None,
        is_deleted: Optional[bool] = None,
        page: int = 1,
        limit: int = 10,
    ) -> Tuple[List[User], int]:
        conditions = []

        if is_deleted is not None:
            conditions.append(User.is_deleted == is_deleted)

        if role is not None:
            role_val = role.value if hasattr(role, "value") else str(role)
            conditions.append(User.role == role_val)

        if email_verified is not None:
            conditions.append(User.email_verified == email_verified)

        if q:
            search_term = f"%{q.strip()}%"
            conditions.append(
                or_(
                    User.first_name.ilike(search_term),
                    User.last_name.ilike(search_term),
                    User.email.ilike(search_term),
                )
            )

        # Count query
        count_stmt = select(func.count(User.id))
        if conditions:
            count_stmt = count_stmt.where(and_(*conditions))
        count_res = await db.execute(count_stmt)
        total_items = count_res.scalar() or 0

        # Data query
        offset = (page - 1) * limit
        stmt = select(User)
        if conditions:
            stmt = stmt.where(and_(*conditions))
        stmt = stmt.order_by(User.created_at.desc()).offset(offset).limit(limit)

        data_res = await db.execute(stmt)
        users = list(data_res.scalars().all())

        return users, total_items

    async def create_user_by_admin(self, db: AsyncSession, user_in: AdminUserCreate) -> User:
        logger.info(f"Admin creating user: {user_in.email} with role {user_in.role}")
        role_val = user_in.role.value if hasattr(user_in.role, "value") else str(user_in.role)
        new_user = User(
            id=uuid.uuid4(),
            email=user_in.email,
            first_name=user_in.first_name.strip(),
            last_name=user_in.last_name.strip() if user_in.last_name else None,
            hashed_password=get_password_hash(user_in.password),
            role=role_val,
            email_verified=user_in.email_verified,
        )
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)
        return new_user

    async def admin_update_user(self, db: AsyncSession, user: User, user_in: AdminUserUpdate) -> User:
        logger.info(f"Admin updating user: {user.id}")
        update_data = user_in.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            if field == "role" and value is not None:
                user.role = value.value if hasattr(value, "value") else str(value)
            elif field == "is_deleted" and value is not None:
                user.is_deleted = value
                user.deleted_at = datetime.now(timezone.utc) if value else None
            elif field in ("first_name", "last_name") and value is not None:
                setattr(user, field, value.strip())
            else:
                setattr(user, field, value)

        await db.commit()
        await db.refresh(user)
        return user

    async def soft_delete_user(self, db: AsyncSession, user: User) -> User:
        logger.info(f"Admin soft-deleting user: {user.id}")
        user.is_deleted = True
        user.deleted_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(user)
        return user

    async def ban_user(self, db: AsyncSession, user: User) -> User:
        logger.info(f"Admin banning user: {user.id}")
        user.is_deleted = True
        user.deleted_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(user)
        return user

    async def unban_user(self, db: AsyncSession, user: User) -> User:
        logger.info(f"Admin unbanning user: {user.id}")
        user.is_deleted = False
        user.deleted_at = None
        await db.commit()
        await db.refresh(user)
        return user


user_service = UserService()

