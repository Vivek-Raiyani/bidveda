from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.request_quote import RFQStatus


# ─────────────────────────────────────────────────────────────
# RFQ Line Item Schemas
# ─────────────────────────────────────────────────────────────

class RFQLineItemBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Name or description of the required item")
    quantity: Decimal = Field(..., gt=0, description="Quantity required (must be > 0)")
    unit: str = Field(..., min_length=1, max_length=50, description="Unit of measurement, e.g. chairs, desks, kg, units")


class RFQLineItemCreate(RFQLineItemBase):
    pass


class RFQLineItemUpdate(BaseModel):
    id: Optional[UUID] = None
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    quantity: Optional[Decimal] = Field(None, gt=0)
    unit: Optional[str] = Field(None, min_length=1, max_length=50)


class RFQLineItemOut(RFQLineItemBase):
    id: UUID
    rfq_id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─────────────────────────────────────────────────────────────
# RFQ Schemas
# ─────────────────────────────────────────────────────────────

class RFQBase(BaseModel):
    title: str = Field(..., min_length=3, max_length=255, description="RFQ Title")
    description: Optional[str] = Field(None, description="Detailed specifications/scope")
    category: str = Field(..., min_length=1, max_length=100, description="Category, e.g. Office Supplies, IT")
    delivery_location: str = Field(..., min_length=1, max_length=255, description="Target delivery city/site")
    budget: Optional[Decimal] = Field(None, gt=0, description="Optional estimated budget")
    deadline: datetime = Field(..., description="Submission deadline timestamp (UTC)")


class RFQCreate(RFQBase):
    line_items: List[RFQLineItemCreate] = Field(..., min_length=1, description="At least one line item required")


class RFQUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=255)
    description: Optional[str] = None
    category: Optional[str] = Field(None, min_length=1, max_length=100)
    delivery_location: Optional[str] = Field(None, min_length=1, max_length=255)
    budget: Optional[Decimal] = Field(None, gt=0)
    deadline: Optional[datetime] = None
    line_items: Optional[List[RFQLineItemCreate]] = None


class RFQStatusUpdate(BaseModel):
    status: RFQStatus
    notes: Optional[str] = None


class RFQListItemOut(BaseModel):
    id: UUID
    buyer_id: UUID
    title: str
    category: str
    delivery_location: str
    budget: Optional[Decimal] = None
    deadline: datetime
    status: RFQStatus
    items_count: int = 0
    quotes_count: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RFQOut(RFQBase):
    id: UUID
    buyer_id: UUID
    buyer_name: Optional[str] = None
    status: RFQStatus
    created_at: datetime
    updated_at: datetime
    line_items: List[RFQLineItemOut] = []
    quotes_count: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)
