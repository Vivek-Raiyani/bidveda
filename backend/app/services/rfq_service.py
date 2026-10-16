import math
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, List, Tuple
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status
from sqlalchemy import select, func, and_, or_, desc, update
from sqlalchemy.orm import selectinload

from app.models.request_quote import RFQ, RFQLineItem, RFQStatus
from app.models.quote import Quote, QuoteItem, QuoteStatus
from app.models.user import User
from app.schemas.request_quote import (
    RFQCreate,
    RFQUpdate,
    RFQOut,
    RFQListItemOut,
    RFQLineItemOut,
    RFQLineItemCreate,
    RFQLineItemUpdate,
)
from app.schemas.quote import ComparisonItemPrice, ComparisonQuoteColumn, RFQComparisonView
from app.services.status_history_service import log_status_change


async def create_rfq(db: AsyncSession, buyer_id: UUID, rfq_in: RFQCreate) -> RFQ:
    """Create a new RFQ in DRAFT status along with its line items."""
    rfq = RFQ(
        buyer_id=buyer_id,
        title=rfq_in.title.strip(),
        description=rfq_in.description.strip() if rfq_in.description else None,
        category=rfq_in.category.strip(),
        delivery_location=rfq_in.delivery_location.strip(),
        budget=rfq_in.budget,
        deadline=rfq_in.deadline,
        status=RFQStatus.DRAFT.value,
    )
    db.add(rfq)
    await db.flush()

    # Add line items
    for item_in in rfq_in.line_items:
        line_item = RFQLineItem(
            rfq_id=rfq.id,
            name=item_in.name.strip(),
            quantity=item_in.quantity,
            unit=item_in.unit.strip(),
        )
        db.add(line_item)

    # Log status history for initial draft creation
    await log_status_change(
        db=db,
        entity_type="rfq",
        entity_id=rfq.id,
        from_status=None,
        to_status=RFQStatus.DRAFT.value,
        changed_by_id=buyer_id,
        notes="RFQ created in draft status",
    )

    await db.commit()
    await db.refresh(rfq)
    return rfq


async def get_rfq_by_id(db: AsyncSession, rfq_id: UUID) -> Optional[RFQ]:
    """Fetch an RFQ by ID with line items and buyer loaded. Auto-closes if deadline passed."""
    stmt = (
        select(RFQ)
        .options(
            selectinload(RFQ.line_items),
            selectinload(RFQ.buyer),
            selectinload(RFQ.quotes),
        )
        .where(RFQ.id == rfq_id, RFQ.is_deleted == False)
    )
    result = await db.execute(stmt)
    rfq = result.scalars().first()

    # Real-time guard: Auto-transition published RFQ to CLOSED if deadline passed
    if rfq and rfq.status == RFQStatus.PUBLISHED.value:
        deadline = rfq.deadline
        if deadline.tzinfo is None:
            deadline = deadline.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) >= deadline:
            old_status = rfq.status
            rfq.status = RFQStatus.CLOSED.value
            await log_status_change(
                db=db,
                entity_type="rfq",
                entity_id=rfq.id,
                from_status=old_status,
                to_status=RFQStatus.CLOSED.value,
                changed_by_id=None,
                notes="RFQ auto-closed due to deadline expiration",
            )
            await db.commit()

    return rfq


async def update_rfq(db: AsyncSession, rfq: RFQ, rfq_in: RFQUpdate) -> RFQ:
    """Update an existing RFQ (only when in DRAFT status)."""
    if rfq_in.title is not None:
        rfq.title = rfq_in.title.strip()
    if rfq_in.description is not None:
        rfq.description = rfq_in.description.strip()
    if rfq_in.category is not None:
        rfq.category = rfq_in.category.strip()
    if rfq_in.delivery_location is not None:
        rfq.delivery_location = rfq_in.delivery_location.strip()
    if rfq_in.budget is not None:
        rfq.budget = rfq_in.budget
    if rfq_in.deadline is not None:
        rfq.deadline = rfq_in.deadline

    # Update line items if provided
    if rfq_in.line_items is not None:
        # Delete existing line items
        for item in list(rfq.line_items):
            await db.delete(item)
        await db.flush()

        # Add new line items
        for item_in in rfq_in.line_items:
            new_item = RFQLineItem(
                rfq_id=rfq.id,
                name=item_in.name.strip(),
                quantity=item_in.quantity,
                unit=item_in.unit.strip(),
            )
            db.add(new_item)

    await db.commit()
    await db.refresh(rfq)
    return rfq


async def add_rfq_line_item(db: AsyncSession, rfq: RFQ, item_in: RFQLineItemCreate) -> RFQLineItem:
    """Add a single line item to an existing draft RFQ."""
    line_item = RFQLineItem(
        rfq_id=rfq.id,
        name=item_in.name.strip(),
        quantity=item_in.quantity,
        unit=item_in.unit.strip(),
    )
    db.add(line_item)
    await db.commit()
    await db.refresh(line_item)
    return line_item


async def update_rfq_line_item(db: AsyncSession, line_item: RFQLineItem, item_in: RFQLineItemUpdate) -> RFQLineItem:
    """Update specific attributes of a single line item in a draft RFQ."""
    if item_in.name is not None:
        line_item.name = item_in.name.strip()
    if item_in.quantity is not None:
        line_item.quantity = item_in.quantity
    if item_in.unit is not None:
        line_item.unit = item_in.unit.strip()

    await db.commit()
    await db.refresh(line_item)
    return line_item


async def delete_rfq_line_item(db: AsyncSession, line_item: RFQLineItem) -> None:
    """Delete a single line item from a draft RFQ."""
    await db.delete(line_item)
    await db.commit()


async def publish_rfq(db: AsyncSession, rfq: RFQ, user_id: UUID) -> RFQ:
    """Transition RFQ from DRAFT to PUBLISHED."""
    old_status = rfq.status
    rfq.status = RFQStatus.PUBLISHED.value

    await log_status_change(
        db=db,
        entity_type="rfq",
        entity_id=rfq.id,
        from_status=old_status,
        to_status=RFQStatus.PUBLISHED.value,
        changed_by_id=user_id,
        notes="RFQ published to marketplace",
    )

    await db.commit()
    await db.refresh(rfq)
    return rfq



async def list_rfqs(
    db: AsyncSession,
    buyer_id: Optional[UUID] = None,
    exclude_drafts: bool = False,
    q: Optional[str] = None,
    category: Optional[str] = None,
    delivery_location: Optional[str] = None,
    status: Optional[RFQStatus] = None,
    deadline_after: Optional[datetime] = None,
    deadline_before: Optional[datetime] = None,
    page: int = 1,
    limit: int = 10,
) -> Tuple[List[RFQ], int]:
    """
    Unified query service for RFQs supporting role-based scoping (buyer_id or exclude_drafts),
    keyword search, category, location, deadline filters, and pagination.
    Real-time guard: automatically transitions any expired published RFQs to CLOSED.
    """
    now = datetime.now(timezone.utc)

    # Real-time guard: Batch-close any expired published RFQs in the database
    expired_rfqs_stmt = select(RFQ.id).where(
        RFQ.status == RFQStatus.PUBLISHED.value,
        RFQ.deadline <= now,
        RFQ.is_deleted == False,
    )
    expired_res = await db.execute(expired_rfqs_stmt)
    expired_ids = list(expired_res.scalars().all())
    if expired_ids:
        await db.execute(
            update(RFQ)
            .where(RFQ.id.in_(expired_ids))
            .values(status=RFQStatus.CLOSED.value)
        )
        for exp_id in expired_ids:
            await log_status_change(
                db=db,
                entity_type="rfq",
                entity_id=exp_id,
                from_status=RFQStatus.PUBLISHED.value,
                to_status=RFQStatus.CLOSED.value,
                changed_by_id=None,
                notes="RFQ auto-closed due to deadline expiration",
            )
        await db.commit()

    conditions = [RFQ.is_deleted == False]

    # Role scoping
    if buyer_id is not None:
        conditions.append(RFQ.buyer_id == buyer_id)

    if exclude_drafts:
        conditions.append(RFQ.status != RFQStatus.DRAFT.value)

    if status is not None:
        conditions.append(RFQ.status == status.value)
    elif exclude_drafts and buyer_id is None:
        # Default for vendors viewing marketplace when no status is explicitly filtered:
        # Only active published RFQs whose deadline has not passed
        conditions.append(RFQ.status == RFQStatus.PUBLISHED.value)
        conditions.append(RFQ.deadline > now)

    if q:
        search_term = f"%{q.strip()}%"
        conditions.append(
            or_(
                RFQ.title.ilike(search_term),
                RFQ.description.ilike(search_term),
            )
        )
    if category:
        conditions.append(RFQ.category.ilike(f"%{category.strip()}%"))
    if delivery_location:
        conditions.append(RFQ.delivery_location.ilike(f"%{delivery_location.strip()}%"))
    if deadline_after:
        conditions.append(RFQ.deadline >= deadline_after)
    if deadline_before:
        conditions.append(RFQ.deadline <= deadline_before)

    # Count query
    count_stmt = select(func.count(RFQ.id)).where(and_(*conditions))
    count_result = await db.execute(count_stmt)
    total_items = count_result.scalar() or 0

    # Data query with pagination
    offset = (page - 1) * limit
    order_clause = (
        [RFQ.created_at.desc()]
        if buyer_id is not None
        else [RFQ.deadline.asc(), RFQ.created_at.desc()]
    )

    data_stmt = (
        select(RFQ)
        .options(
            selectinload(RFQ.line_items),
            selectinload(RFQ.quotes),
        )
        .where(and_(*conditions))
        .order_by(*order_clause)
        .offset(offset)
        .limit(limit)
    )
    data_result = await db.execute(data_stmt)
    rfqs = list(data_result.scalars().all())

    return rfqs, total_items


async def award_rfq_quote(
    db: AsyncSession,
    rfq: RFQ,
    quote_id: UUID,
    notes: Optional[str] = None,
) -> Tuple[RFQ, Quote]:
    """
    Transactionally award an RFQ to a single winning quote:
    1. Winning quote status -> 'accepted'
    2. All other quotes for this RFQ -> 'rejected'
    3. RFQ status -> 'awarded'
    Keeps status history audit logs for RFQ and all affected quotes.
    """
    # Find winning quote
    stmt = (
        select(Quote)
        .options(
            selectinload(Quote.vendor),
            selectinload(Quote.items),
        )
        .where(
            Quote.id == quote_id,
            Quote.rfq_id == rfq.id,
            Quote.is_deleted == False,
        )
    )
    res = await db.execute(stmt)
    target_quote = res.scalars().first()

    if not target_quote:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Quote ID '{quote_id}' was not found or does not belong to this RFQ.",
        )

    # 1. Update winning quote
    old_target_status = target_quote.status
    target_quote.status = QuoteStatus.ACCEPTED.value
    await log_status_change(
        db=db,
        entity_type="quote",
        entity_id=target_quote.id,
        from_status=old_target_status,
        to_status=QuoteStatus.ACCEPTED.value,
        changed_by_id=rfq.buyer_id,
        notes="Winning quote accepted by buyer",
    )

    # 2. Update and log status change for all other quotes for this RFQ to rejected
    other_quotes_stmt = select(Quote).where(
        Quote.rfq_id == rfq.id,
        Quote.id != quote_id,
        Quote.is_deleted == False,
    )
    other_res = await db.execute(other_quotes_stmt)
    other_quotes = list(other_res.scalars().all())
    for other_q in other_quotes:
        old_other_status = other_q.status
        other_q.status = QuoteStatus.REJECTED.value
        await log_status_change(
            db=db,
            entity_type="quote",
            entity_id=other_q.id,
            from_status=old_other_status,
            to_status=QuoteStatus.REJECTED.value,
            changed_by_id=rfq.buyer_id,
            notes="Quote rejected (contract awarded to another vendor)",
        )

    # 3. Update RFQ status to awarded
    old_rfq_status = rfq.status
    rfq.status = RFQStatus.AWARDED.value
    await log_status_change(
        db=db,
        entity_type="rfq",
        entity_id=rfq.id,
        from_status=old_rfq_status,
        to_status=RFQStatus.AWARDED.value,
        changed_by_id=rfq.buyer_id,
        notes=notes or "RFQ awarded to winning quote",
    )

    await db.commit()
    await db.refresh(rfq)
    await db.refresh(target_quote)

    return rfq, target_quote



async def get_rfq_comparison(
    db: AsyncSession,
    rfq: RFQ,
    sort_by: str = "total_amount",
    sort_order: str = "asc",
) -> RFQComparisonView:
    """
    Generate side-by-side comparison matrix of all quotes for an RFQ,
    sortable by total_amount and delivery_days.
    """
    # Fetch all quotes with items and vendor
    stmt = (
        select(Quote)
        .options(
            selectinload(Quote.vendor),
            selectinload(Quote.items).selectinload(QuoteItem.line_item),
        )
        .where(
            Quote.rfq_id == rfq.id,
            Quote.is_deleted == False,
        )
    )
    res = await db.execute(stmt)
    quotes = list(res.scalars().all())

    # Map RFQ line items
    line_items_out = [
        RFQLineItemOut(
            id=item.id,
            rfq_id=item.rfq_id,
            name=item.name,
            quantity=item.quantity,
            unit=item.unit,
            created_at=item.created_at,
        )
        for item in (rfq.line_items or [])
    ]
    rfq_items_map = {item.id: item for item in (rfq.line_items or [])}

    # Build comparison columns for each quote
    quote_columns: List[ComparisonQuoteColumn] = []
    for q in quotes:
        vendor_name = "Unknown Vendor"
        if q.vendor:
            vendor_name = f"{q.vendor.first_name} {q.vendor.last_name or ''}".strip()

        # Map quote line prices in order of RFQ line items
        quote_items_by_line = {qi.line_item_id: qi for qi in (q.items or [])}
        item_prices: List[ComparisonItemPrice] = []
        for line_item in (rfq.line_items or []):
            qi = quote_items_by_line.get(line_item.id)
            if qi:
                item_prices.append(
                    ComparisonItemPrice(
                        line_item_id=line_item.id,
                        line_item_name=line_item.name,
                        quantity=line_item.quantity,
                        unit=line_item.unit,
                        unit_price=qi.unit_price,
                        total_price=qi.total_price,
                    )
                )
            else:
                item_prices.append(
                    ComparisonItemPrice(
                        line_item_id=line_item.id,
                        line_item_name=line_item.name,
                        quantity=line_item.quantity,
                        unit=line_item.unit,
                        unit_price=Decimal("0.00"),
                        total_price=Decimal("0.00"),
                    )
                )

        quote_columns.append(
            ComparisonQuoteColumn(
                quote_id=q.id,
                vendor_id=q.vendor_id,
                vendor_name=vendor_name,
                version=q.version,
                delivery_days=q.delivery_days,
                notes=q.notes,
                total_amount=q.total_amount,
                status=QuoteStatus(q.status),
                created_at=q.created_at,
                item_prices=item_prices,
            )
        )

    # Sort columns
    reverse = sort_order.lower() == "desc"
    if sort_by == "delivery_days":
        quote_columns.sort(key=lambda col: col.delivery_days, reverse=reverse)
    elif sort_by == "created_at":
        quote_columns.sort(key=lambda col: col.created_at, reverse=reverse)
    else:  # default total_amount
        quote_columns.sort(key=lambda col: col.total_amount, reverse=reverse)

    return RFQComparisonView(
        rfq_id=rfq.id,
        rfq_title=rfq.title,
        rfq_status=RFQStatus(rfq.status),
        deadline=rfq.deadline,
        line_items=line_items_out,
        quotes=quote_columns,
    )

