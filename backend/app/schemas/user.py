from pydantic import BaseModel, EmailStr, ConfigDict
from uuid import UUID
from enum import Enum
from app.core.permissions import UserRoleEnum

class SignupRoleEnum(str, Enum):
    BUYER = "buyer"
    VENDOR = "vendor"


class UserBase(BaseModel):
    email: EmailStr


class UserCreate(UserBase):
    first_name: str
    last_name: str | None = None
    password: str
    role: SignupRoleEnum = SignupRoleEnum.BUYER


class UserLogin(UserBase):
    password: str


class UserUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    email: EmailStr | None = None


class UserUpdatePassword(BaseModel):
    current_password: str
    new_password: str


from datetime import datetime


class UserOut(UserBase):
    id: UUID
    first_name: str | None = None
    last_name: str | None = None
    role: UserRoleEnum
    email_verified: bool = False
    is_deleted: bool = False
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class AdminUserCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str | None = None
    role: UserRoleEnum = UserRoleEnum.BUYER
    email_verified: bool = True


class AdminUserUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    email: EmailStr | None = None
    role: UserRoleEnum | None = None
    email_verified: bool | None = None
    is_deleted: bool | None = None

