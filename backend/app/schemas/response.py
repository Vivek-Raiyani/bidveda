from typing import Generic, TypeVar, Optional
from pydantic import BaseModel

T = TypeVar("T")

class MessageResponse(BaseModel):
    code: int = 200
    message: str

class PaginationMeta(BaseModel):
    page: int
    limit: int
    total_pages: int
    total_items: int

class DataResponse(BaseModel, Generic[T]):
    code: int = 200
    data: T
    pagination: Optional[PaginationMeta] = None
