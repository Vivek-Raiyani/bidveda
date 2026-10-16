from sqlalchemy import Boolean, Column, String
from app.models.base import Base, SoftDeleteMixin
from app.core.permissions import UserRoleEnum


class User(SoftDeleteMixin, Base):
    __tablename__ = "users"

    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=True)
    
    role = Column(String, nullable=False, default=UserRoleEnum.BUYER.value)

    email_verified = Column(Boolean, default=False)
