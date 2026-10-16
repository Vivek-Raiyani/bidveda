import math
from datetime import datetime, timezone
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.models.user import User
from app.models.request_quote import RFQ, RFQStatus
from app.models.quote import Quote, QuoteStatus
from app.core.permissions import UserRoleEnum
from app.schemas.response import DataResponse, PaginationMeta
from app.schemas.quote import (
    QuoteCreate,
    QuoteRevise,
    QuoteOut,
    QuoteStatusUpdate,
    ShortlistQuoteRequest,
    StatusHistoryOut,
)
from app.services import quote_service, rfq_service, status_history_service

router = APIRouter()


@router.post("/rfqs/{rfq_id}/quotes", response_model=DataResponse[QuoteOut], status_code=status.HTTP_201_CREATED)
async def submit_quote(
    rfq_id: UUID,
    quote_in: QuoteCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(UserRoleEnum.VENDOR, UserRoleEnum.ADMIN)),
):
    """
    Submit an initial quote against an open RFQ with per-line-item pricing.
    Rules:
    - Only Vendors and Admins can submit quotes.
    - RFQ must be in PUBLISHED status.
    - Strict deadline check: Submission is rejected if now() > rfq.deadline.
    - A vendor can only submit one active quote per RFQ (use PUT to revise).
    """
    rfq = await rfq_service.get_rfq_by_id(db=db, rfq_id=rfq_id)
    if not rfq:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="RFQ not found",
        )

    if rfq.status == RFQStatus.CLOSED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Submission deadline for this RFQ has passed. Quotes can no longer be submitted (RFQ is closed).",
        )

    if rfq.status != RFQStatus.PUBLISHED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Quotes cannot be submitted for RFQ in status '{rfq.status}'. RFQ must be published.",
        )

    # Strict deadline check
    deadline = rfq.deadline
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    if now > deadline:
        old_status = rfq.status
        rfq.status = RFQStatus.CLOSED.value
        await status_history_service.log_status_change(
            db=db,
            entity_type="rfq",
            entity_id=rfq.id,
            from_status=old_status,
            to_status=RFQStatus.CLOSED.value,
            changed_by_id=None,
            notes="RFQ auto-closed due to deadline expiration",
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Submission deadline for this RFQ has passed. Quotes can no longer be submitted (RFQ is closed).",
        )

    # Check if vendor already submitted a quote
    existing_quote = await quote_service.get_vendor_quote_for_rfq(
        db=db,
        rfq_id=rfq_id,
        vendor_id=current_user.id,
    )
    if existing_quote:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already submitted a quote for this RFQ. Please use the revise endpoint to make changes.",
        )

    quote = await quote_service.create_quote(
        db=db,
        rfq=rfq,
        vendor_id=current_user.id,
        quote_in=quote_in,
    )
    return DataResponse(data=quote_service.format_quote_out(quote))


@router.put("/quotes/{id}", response_model=DataResponse[QuoteOut])
async def revise_quote(
    id: UUID,
    quote_in: QuoteRevise,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(UserRoleEnum.VENDOR, UserRoleEnum.ADMIN)),
):
    """
    Revise an existing quote before the RFQ deadline.
    Rules:
    - Only the vendor who submitted the quote (or admin) can revise it.
    - Increments the quote version number.
    - Updates per-line-item pricing, delivery timeline, and notes.
    - Strict deadline check: Revisions are strictly blocked if now() > rfq.deadline.
    - Cannot revise quotes that have already been accepted or rejected.
    """
    quote = await quote_service.get_quote_by_id(db=db, quote_id=id)
    if not quote:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quote not found",
        )

    # Vendor ownership check
    user_role = UserRoleEnum(current_user.role) if isinstance(current_user.role, str) else current_user.role
    if quote.vendor_id != current_user.id and user_role != UserRoleEnum.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify this quote",
        )

    # Quote status check
    if quote.status in (QuoteStatus.ACCEPTED.value, QuoteStatus.REJECTED.value):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot revise quote in status '{quote.status}'.",
        )

    rfq = quote.rfq
    if not rfq:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated RFQ not found.",
        )

    # Strict deadline check & auto-close
    deadline = rfq.deadline
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    if rfq.status == RFQStatus.CLOSED.value or now > deadline:
        if rfq.status == RFQStatus.PUBLISHED.value:
            old_status = rfq.status
            rfq.status = RFQStatus.CLOSED.value
            await status_history_service.log_status_change(
                db=db,
                entity_type="rfq",
                entity_id=rfq.id,
                from_status=old_status,
                to_status=RFQStatus.CLOSED.value,
                changed_by_id=None,
                notes="RFQ auto-closed due to deadline expiration",
            )
            await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Submission deadline for this RFQ has passed. Quotes can no longer be revised (RFQ is closed).",
        )

    if rfq.status != RFQStatus.PUBLISHED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot revise quote because associated RFQ is in status '{rfq.status}'.",
        )

    revised = await quote_service.revise_quote(
        db=db,
        quote=quote,
        rfq=rfq,
        quote_in=quote_in,
    )
    return DataResponse(data=quote_service.format_quote_out(revised))


@router.post("/quotes/{id}/shortlist", response_model=DataResponse[QuoteOut])
async def shortlist_quote(
    id: UUID,
    payload: Optional[ShortlistQuoteRequest] = None,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(UserRoleEnum.BUYER, UserRoleEnum.ADMIN)),
):
    """
    Shortlist a quote for an RFQ.
    Rules:
    - Only the buyer who owns the RFQ (or admin) can shortlist quotes.
    - Associated RFQ cannot be in DRAFT or AWARDED status.
    - Quote cannot be already accepted or rejected.
    """
    quote = await quote_service.get_quote_by_id(db=db, quote_id=id)
    if not quote:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quote not found")

    user_role = UserRoleEnum(current_user.role) if isinstance(current_user.role, str) else current_user.role
    if not quote.rfq or (quote.rfq.buyer_id != current_user.id and user_role != UserRoleEnum.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to shortlist quotes for this RFQ",
        )

    if quote.rfq.status == RFQStatus.DRAFT.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot shortlist quotes for a draft RFQ.",
        )

    if quote.rfq.status == RFQStatus.AWARDED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot shortlist quotes for an RFQ that has already been awarded.",
        )

    if quote.status in (QuoteStatus.ACCEPTED.value, QuoteStatus.REJECTED.value):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot shortlist quote in status '{quote.status}'.",
        )

    notes = payload.notes if payload else None
    updated_quote = await quote_service.shortlist_quote(
        db=db,
        quote=quote,
        buyer_id=current_user.id,
        notes=notes,
    )
    return DataResponse(data=quote_service.format_quote_out(updated_quote))


@router.patch("/quotes/{id}/status", response_model=DataResponse[QuoteOut])
async def update_quote_status(
    id: UUID,
    status_in: QuoteStatusUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(UserRoleEnum.BUYER, UserRoleEnum.ADMIN)),
):
    """
    Update quote status (e.g. to 'shortlisted').
    """
    if status_in.status == QuoteStatus.SHORTLISTED:
        return await shortlist_quote(
            id=id,
            payload=ShortlistQuoteRequest(notes=status_in.notes),
            db=db,
            current_user=current_user,
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only transitioning to 'shortlisted' is supported via this endpoint. Use /rfqs/{id}/award for awarding/rejecting.",
        )


@router.get("/quotes/my", response_model=DataResponse[List[QuoteOut]])
async def list_my_quotes(
    status_filter: Optional[QuoteStatus] = Query(None, alias="status", description="Filter own quotes by status"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Items per page"),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(UserRoleEnum.VENDOR, UserRoleEnum.ADMIN)),
):
    """
    List quotes submitted by the authenticated vendor with pagination.
    """
    quotes, total_items = await quote_service.list_vendor_quotes(
        db=db,
        vendor_id=current_user.id,
        status=status_filter,
        page=page,
        limit=limit,
    )

    total_pages = math.ceil(total_items / limit) if total_items > 0 else 0
    pagination = PaginationMeta(
        page=page,
        limit=limit,
        total_pages=total_pages,
        total_items=total_items,
    )

    data = [quote_service.format_quote_out(q) for q in quotes]
    return DataResponse(data=data, pagination=pagination)


@router.get("/quotes/{id}", response_model=DataResponse[QuoteOut])
async def get_quote_details(
    id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Get detailed information for a single quote.
    Strict Access Control (Vendor Isolation):
    - Vendors can ONLY view their own quote. Attempting to view another vendor's quote returns 403 Forbidden.
    - Buyers can only view quotes submitted against RFQs they own.
    - Admins can view any quote.
    """
    quote = await quote_service.get_quote_by_id(db=db, quote_id=id)
    if not quote:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quote not found",
        )

    user_role = UserRoleEnum(current_user.role) if isinstance(current_user.role, str) else current_user.role

    if user_role == UserRoleEnum.VENDOR:
        if quote.vendor_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to view this quote.",
            )
    elif user_role == UserRoleEnum.BUYER:
        if not quote.rfq or quote.rfq.buyer_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to view quotes for this RFQ.",
            )

    return DataResponse(data=quote_service.format_quote_out(quote))


@router.get("/quotes/{id}/history", response_model=DataResponse[List[StatusHistoryOut]])
async def get_quote_status_history(
    id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Retrieve the complete status transition history audit trail for a quote.
    Access rules:
    - Vendors can only view history for their own quotes.
    - Buyers can only view history for quotes submitted against their RFQs.
    - Admins can view history for any quote.
    """
    quote = await quote_service.get_quote_by_id(db=db, quote_id=id)
    if not quote:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quote not found")

    user_role = UserRoleEnum(current_user.role) if isinstance(current_user.role, str) else current_user.role
    if user_role == UserRoleEnum.VENDOR and quote.vendor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to view this quote's history.",
        )
    elif user_role == UserRoleEnum.BUYER and (not quote.rfq or quote.rfq.buyer_id != current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to view quotes history for this RFQ.",
        )

    history = await status_history_service.get_entity_status_history(
        db=db,
        entity_type="quote",
        entity_id=id,
    )
    return DataResponse(
        data=[status_history_service.format_status_history_out(h) for h in history]
    )

