import math
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, List, Tuple, Dict
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload

from app.models.request_quote import RFQ, RFQLineItem, RFQStatus
from app.models.quote import Quote, QuoteItem, QuoteStatus
from app.models.user import User
from app.schemas.quote import QuoteCreate, QuoteRevise, QuoteOut, QuoteItemOut
from app.services.status_history_service import log_status_change


def format_quote_out(quote: Quote) -> QuoteOut:
    """Helper to convert a Quote DB model into QuoteOut schema."""
    vendor_name = None
    if quote.vendor:
        vendor_name = f"{quote.vendor.first_name} {quote.vendor.last_name or ''}".strip()

    items_out = []
    for q_item in (quote.items or []):
        line_item_name = None
        quantity = None
        unit = None
        if q_item.line_item:
            line_item_name = q_item.line_item.name
            quantity = q_item.line_item.quantity
            unit = q_item.line_item.unit

        items_out.append(
            QuoteItemOut(
                id=q_item.id,
                quote_id=q_item.quote_id,
                line_item_id=q_item.line_item_id,
                line_item_name=line_item_name,
                quantity=quantity,
                unit=unit,
                unit_price=q_item.unit_price,
                total_price=q_item.total_price,
                created_at=q_item.created_at,
            )
        )

    return QuoteOut(
        id=quote.id,
        rfq_id=quote.rfq_id,
        vendor_id=quote.vendor_id,
        vendor_name=vendor_name,
        version=quote.version,
        delivery_days=quote.delivery_days,
        notes=quote.notes,
        total_amount=quote.total_amount,
        status=QuoteStatus(quote.status),
        created_at=quote.created_at,
        updated_at=quote.updated_at,
        items=items_out,
    )


async def get_quote_by_id(db: AsyncSession, quote_id: UUID) -> Optional[Quote]:
    """Fetch a quote with its items, line item details, vendor, and RFQ loaded."""
    stmt = (
        select(Quote)
        .options(
            selectinload(Quote.items).selectinload(QuoteItem.line_item),
            selectinload(Quote.vendor),
            selectinload(Quote.rfq).selectinload(RFQ.line_items),
        )
        .where(Quote.id == quote_id, Quote.is_deleted == False)
    )
    result = await db.execute(stmt)
    return result.scalars().first()


async def get_vendor_quote_for_rfq(db: AsyncSession, rfq_id: UUID, vendor_id: UUID) -> Optional[Quote]:
    """Check if vendor already submitted an active quote for this RFQ."""
    stmt = (
        select(Quote)
        .where(
            Quote.rfq_id == rfq_id,
            Quote.vendor_id == vendor_id,
            Quote.is_deleted == False,
        )
    )
    result = await db.execute(stmt)
    return result.scalars().first()


async def create_quote(
    db: AsyncSession,
    rfq: RFQ,
    vendor_id: UUID,
    quote_in: QuoteCreate,
) -> Quote:
    """Submit an initial quote against an open RFQ with per-line-item pricing."""
    # Map RFQ line items by ID
    line_items_map: Dict[UUID, RFQLineItem] = {item.id: item for item in (rfq.line_items or [])}

    # Verify that all line items belong to this RFQ
    total_amount = Decimal("0.00")
    quote_items_to_create = []

    submitted_line_ids = set()
    for item_in in quote_in.items:
        if item_in.line_item_id not in line_items_map:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Line item ID '{item_in.line_item_id}' does not belong to this RFQ.",
            )
        if item_in.line_item_id in submitted_line_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Duplicate pricing provided for line item '{item_in.line_item_id}'.",
            )
        submitted_line_ids.add(item_in.line_item_id)

        line_item = line_items_map[item_in.line_item_id]
        item_total = Decimal(str(item_in.unit_price)) * Decimal(str(line_item.quantity))
        total_amount += item_total

        quote_items_to_create.append((item_in.line_item_id, item_in.unit_price, item_total))

    # Check that all RFQ line items are covered
    required_ids = set(line_items_map.keys())
    missing_ids = required_ids - submitted_line_ids
    if missing_ids:
        missing_names = [line_items_map[mid].name for mid in missing_ids]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Quotes must include pricing for all line items. Missing: {', '.join(missing_names)}",
        )

    # Create the Quote record
    quote = Quote(
        rfq_id=rfq.id,
        vendor_id=vendor_id,
        version=1,
        delivery_days=quote_in.delivery_days,
        notes=quote_in.notes.strip() if quote_in.notes else None,
        total_amount=total_amount,
        status=QuoteStatus.SUBMITTED.value,
    )
    db.add(quote)
    await db.flush()

    # Add Quote items
    for line_id, u_price, t_price in quote_items_to_create:
        q_item = QuoteItem(
            quote_id=quote.id,
            line_item_id=line_id,
            unit_price=u_price,
            total_price=t_price,
        )
        db.add(q_item)

    # Log status history for quote submission
    await log_status_change(
        db=db,
        entity_type="quote",
        entity_id=quote.id,
        from_status=None,
        to_status=QuoteStatus.SUBMITTED.value,
        changed_by_id=vendor_id,
        notes="Initial quote submitted",
    )

    await db.commit()
    return await get_quote_by_id(db, quote.id)


async def revise_quote(
    db: AsyncSession,
    quote: Quote,
    rfq: RFQ,
    quote_in: QuoteRevise,
) -> Quote:
    """Revise an existing quote before the RFQ deadline."""
    line_items_map: Dict[UUID, RFQLineItem] = {item.id: item for item in (rfq.line_items or [])}

    total_amount = Decimal("0.00")
    quote_items_to_create = []

    submitted_line_ids = set()
    for item_in in quote_in.items:
        if item_in.line_item_id not in line_items_map:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Line item ID '{item_in.line_item_id}' does not belong to this RFQ.",
            )
        if item_in.line_item_id in submitted_line_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Duplicate pricing provided for line item '{item_in.line_item_id}'.",
            )
        submitted_line_ids.add(item_in.line_item_id)

        line_item = line_items_map[item_in.line_item_id]
        item_total = Decimal(str(item_in.unit_price)) * Decimal(str(line_item.quantity))
        total_amount += item_total

        quote_items_to_create.append((item_in.line_item_id, item_in.unit_price, item_total))

    required_ids = set(line_items_map.keys())
    missing_ids = required_ids - submitted_line_ids
    if missing_ids:
        missing_names = [line_items_map[mid].name for mid in missing_ids]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Quotes must include pricing for all line items. Missing: {', '.join(missing_names)}",
        )

    # Update quote fields & increment version
    quote.version += 1
    if quote_in.delivery_days is not None:
        quote.delivery_days = quote_in.delivery_days
    if quote_in.notes is not None:
        quote.notes = quote_in.notes.strip() if quote_in.notes else None
    quote.total_amount = total_amount

    # Delete existing items and insert revised ones
    for old_item in list(quote.items):
        await db.delete(old_item)
    await db.flush()

    for line_id, u_price, t_price in quote_items_to_create:
        new_q_item = QuoteItem(
            quote_id=quote.id,
            line_item_id=line_id,
            unit_price=u_price,
            total_price=t_price,
        )
        db.add(new_q_item)

    # Log status history for quote revision
    await log_status_change(
        db=db,
        entity_type="quote",
        entity_id=quote.id,
        from_status=quote.status,
        to_status=QuoteStatus.SUBMITTED.value,
        changed_by_id=quote.vendor_id,
        notes=f"Quote revised to version {quote.version}",
    )

    await db.commit()
    return await get_quote_by_id(db, quote.id)


async def shortlist_quote(
    db: AsyncSession,
    quote: Quote,
    buyer_id: UUID,
    notes: Optional[str] = None,
) -> Quote:
    """Transition quote status from 'submitted' to 'shortlisted' by the buyer."""
    old_status = quote.status
    quote.status = QuoteStatus.SHORTLISTED.value

    await log_status_change(
        db=db,
        entity_type="quote",
        entity_id=quote.id,
        from_status=old_status,
        to_status=QuoteStatus.SHORTLISTED.value,
        changed_by_id=buyer_id,
        notes=notes or "Quote shortlisted by buyer",
    )

    await db.commit()
    await db.refresh(quote)
    return quote



async def list_vendor_quotes(
    db: AsyncSession,
    vendor_id: UUID,
    status: Optional[QuoteStatus] = None,
    page: int = 1,
    limit: int = 10,
) -> Tuple[List[Quote], int]:
    """List quotes submitted by a specific vendor with pagination."""
    conditions = [
        Quote.vendor_id == vendor_id,
        Quote.is_deleted == False,
    ]
    if status is not None:
        conditions.append(Quote.status == status.value)

    count_stmt = select(func.count(Quote.id)).where(and_(*conditions))
    count_result = await db.execute(count_stmt)
    total_items = count_result.scalar() or 0

    offset = (page - 1) * limit
    data_stmt = (
        select(Quote)
        .options(
            selectinload(Quote.items).selectinload(QuoteItem.line_item),
            selectinload(Quote.vendor),
            selectinload(Quote.rfq),
        )
        .where(and_(*conditions))
        .order_by(Quote.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    data_result = await db.execute(data_stmt)
    quotes = list(data_result.scalars().all())

    return quotes, total_items
