from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field

from app.models.quote import QuoteStatus
from app.models.request_quote import RFQStatus
from app.schemas.request_quote import RFQLineItemOut


# ─────────────────────────────────────────────────────────────
# Quote Item Schemas
# ─────────────────────────────────────────────────────────────

class QuoteItemCreate(BaseModel):
    line_item_id: UUID = Field(..., description="ID of the RFQ line item being priced")
    unit_price: Decimal = Field(..., ge=0, description="Offered price per unit (must be >= 0)")


class QuoteItemOut(BaseModel):
    id: UUID
    quote_id: UUID
    line_item_id: UUID
    line_item_name: Optional[str] = None
    quantity: Optional[Decimal] = None
    unit: Optional[str] = None
    unit_price: Decimal
    total_price: Decimal
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─────────────────────────────────────────────────────────────
# Quote Submission & Revision Schemas
# ─────────────────────────────────────────────────────────────

class QuoteCreate(BaseModel):
    delivery_days: int = Field(..., gt=0, description="Promised delivery time in days (must be > 0)")
    notes: Optional[str] = Field(None, description="Vendor remarks, terms, or conditions")
    items: List[QuoteItemCreate] = Field(..., min_length=1, description="Pricing for each line item")


class QuoteRevise(BaseModel):
    delivery_days: Optional[int] = Field(None, gt=0, description="Updated delivery time in days")
    notes: Optional[str] = Field(None, description="Updated notes")
    items: List[QuoteItemCreate] = Field(..., min_length=1, description="Updated pricing per line item")


class QuoteStatusUpdate(BaseModel):
    status: QuoteStatus
    notes: Optional[str] = None


class ShortlistQuoteRequest(BaseModel):
    notes: Optional[str] = Field(None, description="Optional notes or remarks when shortlisting a quote")


class QuoteOut(BaseModel):
    id: UUID
    rfq_id: UUID
    vendor_id: UUID
    vendor_name: Optional[str] = None
    version: int
    delivery_days: int
    notes: Optional[str] = None
    total_amount: Decimal
    status: QuoteStatus
    created_at: datetime
    updated_at: datetime
    items: List[QuoteItemOut] = []

    model_config = ConfigDict(from_attributes=True)


# ─────────────────────────────────────────────────────────────
# Comparison Grid View Schemas
# ─────────────────────────────────────────────────────────────

class ComparisonItemPrice(BaseModel):
    line_item_id: UUID
    line_item_name: str
    quantity: Decimal
    unit: str
    unit_price: Decimal
    total_price: Decimal


class ComparisonQuoteColumn(BaseModel):
    quote_id: UUID
    vendor_id: UUID
    vendor_name: str
    version: int
    delivery_days: int
    notes: Optional[str] = None
    total_amount: Decimal
    status: QuoteStatus
    created_at: datetime
    item_prices: List[ComparisonItemPrice] = []

    model_config = ConfigDict(from_attributes=True)


class RFQComparisonView(BaseModel):
    rfq_id: UUID
    rfq_title: str
    rfq_status: RFQStatus
    deadline: datetime
    line_items: List[RFQLineItemOut] = []
    quotes: List[ComparisonQuoteColumn] = []

    model_config = ConfigDict(from_attributes=True)


# ─────────────────────────────────────────────────────────────
# Award Flow & Status History Schemas
# ─────────────────────────────────────────────────────────────

class AwardQuoteRequest(BaseModel):
    quote_id: UUID = Field(..., description="The quote ID to award")
    notes: Optional[str] = Field(None, description="Optional award notes / decision reasoning")


class AwardQuoteResponse(BaseModel):
    rfq_id: UUID
    awarded_quote_id: UUID
    awarded_vendor_id: UUID
    awarded_vendor_name: Optional[str] = None
    total_amount: Decimal
    delivery_days: int
    status: RFQStatus
    message: str = "RFQ successfully awarded"


class StatusHistoryOut(BaseModel):
    id: UUID
    entity_type: str
    entity_id: UUID
    from_status: Optional[str] = None
    to_status: str
    changed_by_id: Optional[UUID] = None
    changed_by_name: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
