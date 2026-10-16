from enum import Enum
from sqlalchemy import Column, String, Text, Integer, Numeric, DateTime, ForeignKey, Table, UUID
from sqlalchemy.orm import relationship
from app.models.base import Base, SoftDeleteMixin


class QuoteStatus(str, Enum):
    SUBMITTED = "submitted"
    SHORTLISTED = "shortlisted"
    ACCEPTED = "accepted"
    REJECTED = "rejected"



class Quote(SoftDeleteMixin, Base):
    __tablename__ = "quotes"

    rfq_id = Column(
        UUID(as_uuid=True),
        ForeignKey("rfqs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    vendor_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version = Column(Integer, default=1, nullable=False)
    delivery_days = Column(Integer, nullable=False, index=True)
    notes = Column(Text, nullable=True)
    total_amount = Column(Numeric(14, 2), nullable=False, default=0.0, index=True)
    status = Column(String(50), nullable=False, default=QuoteStatus.SUBMITTED.value, index=True)

    # Relationships
    rfq = relationship("RFQ", back_populates="quotes")
    vendor = relationship("User", foreign_keys=[vendor_id], lazy="selectin")
    items = relationship(
        "QuoteItem",
        back_populates="quote",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="QuoteItem.created_at",
    )


class QuoteItem(Base):
    __tablename__ = "quote_items"

    quote_id = Column(
        UUID(as_uuid=True),
        ForeignKey("quotes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    line_item_id = Column(
        UUID(as_uuid=True),
        ForeignKey("rfq_line_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    unit_price = Column(Numeric(14, 2), nullable=False)
    total_price = Column(Numeric(14, 2), nullable=False)

    # Relationships
    quote = relationship("Quote", back_populates="items")
    line_item = relationship("RFQLineItem", back_populates="quote_items", lazy="selectin")


class StatusHistory(Base):
    __tablename__ = "status_histories"

    entity_type = Column(String(50), nullable=False, index=True)  # "rfq" or "quote"
    entity_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    from_status = Column(String(50), nullable=True)
    to_status = Column(String(50), nullable=False)
    changed_by_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    notes = Column(Text, nullable=True)

    # Relationships
    changed_by = relationship("User", foreign_keys=[changed_by_id], lazy="selectin")
