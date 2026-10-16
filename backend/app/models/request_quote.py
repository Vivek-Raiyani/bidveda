from enum import Enum
from sqlalchemy import Column, String, Text, Numeric, DateTime, ForeignKey, Table, UUID
from sqlalchemy.orm import relationship
from app.models.base import Base, SoftDeleteMixin


class RFQStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    CLOSED = "closed"
    AWARDED = "awarded"




class RFQ(SoftDeleteMixin, Base):
    __tablename__ = "rfqs"

    buyer_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=False, index=True)
    delivery_location = Column(String(255), nullable=False, index=True)
    budget = Column(Numeric(14, 2), nullable=True)
    deadline = Column(DateTime(timezone=True), nullable=False, index=True)
    status = Column(String(50), nullable=False, default=RFQStatus.DRAFT.value, index=True)

    # Relationships
    buyer = relationship("User", foreign_keys=[buyer_id], lazy="selectin")
    line_items = relationship(
        "RFQLineItem",
        back_populates="rfq",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="RFQLineItem.created_at",
    )
    quotes = relationship(
        "Quote",
        back_populates="rfq",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class RFQLineItem(Base):
    __tablename__ = "rfq_line_items"

    rfq_id = Column(
        UUID(as_uuid=True),
        ForeignKey("rfqs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False)
    quantity = Column(Numeric(12, 2), nullable=False)
    unit = Column(String(50), nullable=False)

    # Relationships
    rfq = relationship("RFQ", back_populates="line_items")
    quote_items = relationship(
        "QuoteItem",
        back_populates="line_item",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
