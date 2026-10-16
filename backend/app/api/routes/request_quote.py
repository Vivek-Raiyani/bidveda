import math
from datetime import datetime, timezone
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.models.user import User
from app.models.request_quote import RFQ, RFQStatus
from app.core.permissions import UserRoleEnum, Permission
from app.schemas.response import DataResponse, PaginationMeta, MessageResponse
from app.schemas.request_quote import (
    RFQCreate,
    RFQUpdate,
    RFQOut,
    RFQListItemOut,
    RFQLineItemOut,
    RFQLineItemCreate,
    RFQLineItemUpdate,
)
from app.schemas.quote import (
    AwardQuoteRequest,
    AwardQuoteResponse,
    RFQComparisonView,
    StatusHistoryOut,
)
from app.services import rfq_service, status_history_service


router = APIRouter()


def _format_rfq_out(rfq: RFQ) -> RFQOut:
    """Helper to convert an RFQ DB model to RFQOut schema."""
    buyer_name = None
    if rfq.buyer:
        buyer_name = f"{rfq.buyer.first_name} {rfq.buyer.last_name or ''}".strip()

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

    return RFQOut(
        id=rfq.id,
        buyer_id=rfq.buyer_id,
        buyer_name=buyer_name,
        title=rfq.title,
        description=rfq.description,
        category=rfq.category,
        delivery_location=rfq.delivery_location,
        budget=rfq.budget,
        deadline=rfq.deadline,
        status=RFQStatus(rfq.status),
        created_at=rfq.created_at,
        updated_at=rfq.updated_at,
        line_items=line_items_out,
        quotes_count=len(rfq.quotes) if rfq.quotes is not None else 0,
    )


def _format_rfq_list_item(rfq: RFQ) -> RFQListItemOut:
    """Helper to convert an RFQ DB model to RFQListItemOut schema."""
    return RFQListItemOut(
        id=rfq.id,
        buyer_id=rfq.buyer_id,
        title=rfq.title,
        category=rfq.category,
        delivery_location=rfq.delivery_location,
        budget=rfq.budget,
        deadline=rfq.deadline,
        status=RFQStatus(rfq.status),
        items_count=len(rfq.line_items) if rfq.line_items is not None else 0,
        quotes_count=len(rfq.quotes) if rfq.quotes is not None else 0,
        created_at=rfq.created_at,
        updated_at=rfq.updated_at,
    )


@router.post("", response_model=DataResponse[RFQOut], status_code=status.HTTP_201_CREATED)
async def create_rfq(
    rfq_in: RFQCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(UserRoleEnum.BUYER, UserRoleEnum.ADMIN)),
):
    """
    Create a new RFQ in DRAFT status with line items.
    Only Buyers and Admins can create RFQs.
    """
    now = datetime.now(timezone.utc)
    # Ensure deadline is in the future
    deadline = rfq_in.deadline
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)
    if deadline <= now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Submission deadline must be a future date and time.",
        )

    rfq = await rfq_service.create_rfq(db=db, buyer_id=current_user.id, rfq_in=rfq_in)
    return DataResponse(data=_format_rfq_out(rfq))


@router.get("", response_model=DataResponse[List[RFQListItemOut]])
async def list_rfqs(
    q: Optional[str] = Query(None, description="Search keyword in title or description"),
    category: Optional[str] = Query(None, description="Filter by category"),
    delivery_location: Optional[str] = Query(None, description="Filter by delivery location"),
    status_filter: Optional[RFQStatus] = Query(None, alias="status", description="Filter by status"),
    deadline_after: Optional[datetime] = Query(None, description="Filter deadline on or after timestamp"),
    deadline_before: Optional[datetime] = Query(None, description="Filter deadline on or before timestamp"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Items per page"),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Unified list endpoint for RFQs with automatic role-based scoping:
    - Buyers: Automatically scoped to their own RFQs (buyer_id = current_user.id).
      Never see other buyers' RFQs. Full search and filters supported.
    - Vendors: View open marketplace RFQs with search & filters (drafts strictly excluded).
    - Admins: Unrestricted view across all RFQs.
    """
    user_role = UserRoleEnum(current_user.role) if isinstance(current_user.role, str) else current_user.role

    buyer_id = None
    exclude_drafts = False

    if user_role == UserRoleEnum.BUYER:
        # Strict buyer isolation: Always scope to authenticated buyer
        buyer_id = current_user.id
    elif user_role == UserRoleEnum.VENDOR:
        # Vendors see marketplace RFQs, never drafts
        exclude_drafts = True
    elif user_role != UserRoleEnum.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user doesn't have enough privileges",
        )

    rfqs, total_items = await rfq_service.list_rfqs(
        db=db,
        buyer_id=buyer_id,
        exclude_drafts=exclude_drafts,
        q=q,
        category=category,
        delivery_location=delivery_location,
        status=status_filter,
        deadline_after=deadline_after,
        deadline_before=deadline_before,
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

    data = [_format_rfq_list_item(rfq) for rfq in rfqs]
    return DataResponse(data=data, pagination=pagination)


@router.get("/my", response_model=DataResponse[List[RFQListItemOut]])
async def list_my_rfqs(
    q: Optional[str] = Query(None, description="Search keyword in title or description"),
    category: Optional[str] = Query(None, description="Filter by category"),
    delivery_location: Optional[str] = Query(None, description="Filter by delivery location"),
    status_filter: Optional[RFQStatus] = Query(None, alias="status", description="Filter own RFQs by status"),
    deadline_after: Optional[datetime] = Query(None, description="Filter deadline on or after timestamp"),
    deadline_before: Optional[datetime] = Query(None, description="Filter deadline on or before timestamp"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Items per page"),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(UserRoleEnum.BUYER, UserRoleEnum.ADMIN)),
):
    """
    Convenience alias to list the buyer's own RFQs with search and filters.
    """
    rfqs, total_items = await rfq_service.list_rfqs(
        db=db,
        buyer_id=current_user.id,
        q=q,
        category=category,
        delivery_location=delivery_location,
        status=status_filter,
        deadline_after=deadline_after,
        deadline_before=deadline_before,
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

    data = [_format_rfq_list_item(rfq) for rfq in rfqs]
    return DataResponse(data=data, pagination=pagination)


@router.get("/{id}", response_model=DataResponse[RFQOut])
async def get_rfq_details(
    id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Detailed RFQ view with line items.
    Access rules:
    - Buyers can ONLY view their own RFQs in any state.
    - Buyers CANNOT view other buyers' RFQs (returns 403 Forbidden).
    - Admins can view any RFQ.
    - Vendors can only view RFQs that have been published/closed/awarded (never drafts).
    - Vendors can NEVER view other vendors' submitted quotes.
    """
    rfq = await rfq_service.get_rfq_by_id(db=db, rfq_id=id)
    if not rfq:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="RFQ not found")

    user_role = UserRoleEnum(current_user.role) if isinstance(current_user.role, str) else current_user.role

    # Access control:
    # 1. Buyers can only view their own RFQs, never other buyers' RFQs
    if user_role == UserRoleEnum.BUYER:
        if rfq.buyer_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to view other buyers' RFQs",
            )
    # 2. Vendors can only view published, closed, or awarded RFQs (never drafts)
    elif user_role == UserRoleEnum.VENDOR:
        if rfq.status == RFQStatus.DRAFT.value:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="RFQ not found or not published",
            )
    # 3. Admins have access to everything, any other role is forbidden
    elif user_role != UserRoleEnum.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user doesn't have enough privileges",
        )

    return DataResponse(data=_format_rfq_out(rfq))


@router.put("/{id}", response_model=DataResponse[RFQOut])
async def update_rfq(
    id: UUID,
    rfq_in: RFQUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(UserRoleEnum.BUYER, UserRoleEnum.ADMIN)),
):
    """
    Edit an RFQ and its line items.
    Rules:
    - Only the buyer who created the RFQ (or admin) can edit it.
    - Editing is ONLY allowed when the RFQ is still in DRAFT status.
    """
    rfq = await rfq_service.get_rfq_by_id(db=db, rfq_id=id)
    if not rfq:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="RFQ not found")

    user_role = UserRoleEnum(current_user.role) if isinstance(current_user.role, str) else current_user.role
    if rfq.buyer_id != current_user.id and user_role != UserRoleEnum.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to edit this RFQ",
        )

    if rfq.status != RFQStatus.DRAFT.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot edit RFQ in status '{rfq.status}'. Only draft RFQs can be modified.",
        )

    if rfq_in.deadline is not None:
        deadline = rfq_in.deadline
        if deadline.tzinfo is None:
            deadline = deadline.replace(tzinfo=timezone.utc)
        if deadline <= datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Submission deadline must be a future date and time.",
            )

    updated_rfq = await rfq_service.update_rfq(db=db, rfq=rfq, rfq_in=rfq_in)
    return DataResponse(data=_format_rfq_out(updated_rfq))


@router.post("/{id}/items", response_model=DataResponse[RFQLineItemOut], status_code=status.HTTP_201_CREATED)
async def add_rfq_line_item(
    id: UUID,
    item_in: RFQLineItemCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(UserRoleEnum.BUYER, UserRoleEnum.ADMIN)),
):
    """
    Add a single line item to an existing RFQ.
    Rules:
    - Only the buyer who owns the RFQ (or admin) can add line items.
    - Adding line items is ONLY allowed when the RFQ is still in DRAFT status.
    """
    rfq = await rfq_service.get_rfq_by_id(db=db, rfq_id=id)
    if not rfq:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="RFQ not found")

    user_role = UserRoleEnum(current_user.role) if isinstance(current_user.role, str) else current_user.role
    if rfq.buyer_id != current_user.id and user_role != UserRoleEnum.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify line items for this RFQ",
        )

    if rfq.status != RFQStatus.DRAFT.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot add line item to RFQ in status '{rfq.status}'. Only draft RFQs can be modified.",
        )

    new_item = await rfq_service.add_rfq_line_item(db=db, rfq=rfq, item_in=item_in)
    return DataResponse(
        data=RFQLineItemOut(
            id=new_item.id,
            rfq_id=new_item.rfq_id,
            name=new_item.name,
            quantity=new_item.quantity,
            unit=new_item.unit,
            created_at=new_item.created_at,
        )
    )


@router.put("/{id}/items/{item_id}", response_model=DataResponse[RFQLineItemOut])
async def update_rfq_line_item(
    id: UUID,
    item_id: UUID,
    item_in: RFQLineItemUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(UserRoleEnum.BUYER, UserRoleEnum.ADMIN)),
):
    """
    Update an individual line item of an RFQ.
    Rules:
    - Only the buyer who owns the RFQ (or admin) can update line items.
    - Updating is ONLY allowed when the RFQ is still in DRAFT status.
    """
    rfq = await rfq_service.get_rfq_by_id(db=db, rfq_id=id)
    if not rfq:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="RFQ not found")

    user_role = UserRoleEnum(current_user.role) if isinstance(current_user.role, str) else current_user.role
    if rfq.buyer_id != current_user.id and user_role != UserRoleEnum.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify line items for this RFQ",
        )

    if rfq.status != RFQStatus.DRAFT.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot update line item in RFQ in status '{rfq.status}'. Only draft RFQs can be modified.",
        )

    target_item = next((item for item in (rfq.line_items or []) if item.id == item_id), None)
    if not target_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Line item not found in this RFQ",
        )

    updated_item = await rfq_service.update_rfq_line_item(db=db, line_item=target_item, item_in=item_in)
    return DataResponse(
        data=RFQLineItemOut(
            id=updated_item.id,
            rfq_id=updated_item.rfq_id,
            name=updated_item.name,
            quantity=updated_item.quantity,
            unit=updated_item.unit,
            created_at=updated_item.created_at,
        )
    )


@router.delete("/{id}/items/{item_id}", response_model=MessageResponse)
async def delete_rfq_line_item(
    id: UUID,
    item_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(UserRoleEnum.BUYER, UserRoleEnum.ADMIN)),
):
    """
    Delete an individual line item from a draft RFQ.
    Rules:
    - Only the buyer who owns the RFQ (or admin) can delete line items.
    - Deletion is ONLY allowed when the RFQ is still in DRAFT status.
    - RFQ must have at least one line item remaining.
    """
    rfq = await rfq_service.get_rfq_by_id(db=db, rfq_id=id)
    if not rfq:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="RFQ not found")

    user_role = UserRoleEnum(current_user.role) if isinstance(current_user.role, str) else current_user.role
    if rfq.buyer_id != current_user.id and user_role != UserRoleEnum.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify line items for this RFQ",
        )

    if rfq.status != RFQStatus.DRAFT.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete line item from RFQ in status '{rfq.status}'. Only draft RFQs can be modified.",
        )

    if len(rfq.line_items or []) <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete the only line item. An RFQ must have at least one line item.",
        )

    target_item = next((item for item in (rfq.line_items or []) if item.id == item_id), None)
    if not target_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Line item not found in this RFQ",
        )

    await rfq_service.delete_rfq_line_item(db=db, line_item=target_item)
    return MessageResponse(message="Line item successfully deleted")


@router.post("/{id}/publish", response_model=DataResponse[RFQOut])

async def publish_rfq(
    id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(UserRoleEnum.BUYER, UserRoleEnum.ADMIN)),
):
    """
    Publish an RFQ.
    Moves status from DRAFT to PUBLISHED.
    Rules:
    - Only the buyer who created the RFQ (or admin) can publish it.
    - RFQ must be in DRAFT status.
    - Deadline must not have passed.
    """
    rfq = await rfq_service.get_rfq_by_id(db=db, rfq_id=id)
    if not rfq:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="RFQ not found")

    user_role = UserRoleEnum(current_user.role) if isinstance(current_user.role, str) else current_user.role
    if rfq.buyer_id != current_user.id and user_role != UserRoleEnum.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to publish this RFQ",
        )

    if rfq.status != RFQStatus.DRAFT.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot publish RFQ from status '{rfq.status}'. Only draft RFQs can be published.",
        )

    deadline = rfq.deadline
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)
    if deadline <= datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot publish RFQ whose deadline has already passed. Please update the deadline first.",
        )

    published_rfq = await rfq_service.publish_rfq(db=db, rfq=rfq, user_id=current_user.id)
    return DataResponse(data=_format_rfq_out(published_rfq))


@router.get("/{id}/compare", response_model=DataResponse[RFQComparisonView])
async def compare_rfq_quotes(
    id: UUID,
    sort_by: Optional[str] = Query("total_amount", pattern="^(total_amount|delivery_days|created_at)$", description="Sort quotes by total_amount, delivery_days, or created_at"),
    sort_order: Optional[str] = Query("asc", pattern="^(asc|desc)$", description="Sort order asc or desc"),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(UserRoleEnum.BUYER, UserRoleEnum.ADMIN)),
):
    """
    Side-by-side comparison matrix of all quotes submitted for an RFQ.
    Rules:
    - Only the buyer who owns the RFQ (or admin) can view the comparison grid.
    - Sortable by total price (total_amount) or delivery time (delivery_days).
    """
    rfq = await rfq_service.get_rfq_by_id(db=db, rfq_id=id)
    if not rfq:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="RFQ not found")

    user_role = UserRoleEnum(current_user.role) if isinstance(current_user.role, str) else current_user.role
    if rfq.buyer_id != current_user.id and user_role != UserRoleEnum.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view quotes comparison for this RFQ",
        )

    comparison_view = await rfq_service.get_rfq_comparison(
        db=db,
        rfq=rfq,
        sort_by=sort_by or "total_amount",
        sort_order=sort_order or "asc",
    )
    return DataResponse(data=comparison_view)


@router.post("/{id}/award", response_model=DataResponse[AwardQuoteResponse])
async def award_rfq(
    id: UUID,
    award_in: AwardQuoteRequest,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(UserRoleEnum.BUYER, UserRoleEnum.ADMIN)),
):
    """
    Transactional award endpoint:
    - Sets selected quote to 'accepted'.
    - Sets all other quotes for this RFQ to 'rejected'.
    - Sets RFQ status to 'awarded'.
    Rules:
    - Only the buyer who owns the RFQ (or admin) can award it.
    - RFQ must be in PUBLISHED or CLOSED status (cannot award DRAFT).
    - Cannot award an RFQ that has already been awarded.
    """
    rfq = await rfq_service.get_rfq_by_id(db=db, rfq_id=id)
    if not rfq:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="RFQ not found")

    user_role = UserRoleEnum(current_user.role) if isinstance(current_user.role, str) else current_user.role
    if rfq.buyer_id != current_user.id and user_role != UserRoleEnum.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to award this RFQ",
        )

    if rfq.status == RFQStatus.AWARDED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="RFQ has already been awarded.",
        )

    if rfq.status == RFQStatus.DRAFT.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot award a draft RFQ. It must be published first.",
        )

    awarded_rfq, winning_quote = await rfq_service.award_rfq_quote(
        db=db,
        rfq=rfq,
        quote_id=award_in.quote_id,
        notes=award_in.notes,
    )

    vendor_name = None
    if winning_quote.vendor:
        vendor_name = f"{winning_quote.vendor.first_name} {winning_quote.vendor.last_name or ''}".strip()

    response_data = AwardQuoteResponse(
        rfq_id=awarded_rfq.id,
        awarded_quote_id=winning_quote.id,
        awarded_vendor_id=winning_quote.vendor_id,
        awarded_vendor_name=vendor_name,
        total_amount=winning_quote.total_amount,
        delivery_days=winning_quote.delivery_days,
        status=RFQStatus(awarded_rfq.status),
        message=f"RFQ successfully awarded to {vendor_name or 'vendor'}.",
    )
    return DataResponse(data=response_data)


@router.get("/{id}/history", response_model=DataResponse[List[StatusHistoryOut]])
async def get_rfq_status_history(
    id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Retrieve the complete status transition history audit trail for an RFQ.
    Access rules:
    - Buyers can only view history for their own RFQs.
    - Vendors can only view history for published/closed/awarded RFQs.
    - Admins can view history for any RFQ.
    """
    rfq = await rfq_service.get_rfq_by_id(db=db, rfq_id=id)
    if not rfq:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="RFQ not found")

    user_role = UserRoleEnum(current_user.role) if isinstance(current_user.role, str) else current_user.role
    if user_role == UserRoleEnum.BUYER and rfq.buyer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view history for this RFQ",
        )
    elif user_role == UserRoleEnum.VENDOR and rfq.status == RFQStatus.DRAFT.value:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="RFQ not found or not published",
        )

    history = await status_history_service.get_entity_status_history(
        db=db,
        entity_type="rfq",
        entity_id=id,
    )
    return DataResponse(
        data=[status_history_service.format_status_history_out(h) for h in history]
    )


