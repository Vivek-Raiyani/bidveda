from typing import Optional, List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.quote import StatusHistory
from app.schemas.quote import StatusHistoryOut


async def log_status_change(
    db: AsyncSession,
    entity_type: str,  # "rfq" or "quote"
    entity_id: UUID,
    from_status: Optional[str],
    to_status: str,
    changed_by_id: Optional[UUID] = None,
    notes: Optional[str] = None,
) -> StatusHistory:
    """Insert an audit log entry into status_histories."""
    history = StatusHistory(
        entity_type=entity_type,
        entity_id=entity_id,
        from_status=from_status,
        to_status=to_status,
        changed_by_id=changed_by_id,
        notes=notes,
    )
    db.add(history)
    await db.flush()
    return history


async def get_entity_status_history(
    db: AsyncSession,
    entity_type: str,
    entity_id: UUID,
) -> List[StatusHistory]:
    """Retrieve all status transition records for a given entity in chronological order."""
    stmt = (
        select(StatusHistory)
        .options(selectinload(StatusHistory.changed_by))
        .where(
            StatusHistory.entity_type == entity_type,
            StatusHistory.entity_id == entity_id,
        )
        .order_by(StatusHistory.created_at.asc())
    )
    res = await db.execute(stmt)
    return list(res.scalars().all())


def format_status_history_out(item: StatusHistory) -> StatusHistoryOut:
    """Format StatusHistory DB model into StatusHistoryOut schema."""
    changed_by_name = None
    if item.changed_by:
        changed_by_name = f"{item.changed_by.first_name} {item.changed_by.last_name or ''}".strip()

    return StatusHistoryOut(
        id=item.id,
        entity_type=item.entity_type,
        entity_id=item.entity_id,
        from_status=item.from_status,
        to_status=item.to_status,
        changed_by_id=item.changed_by_id,
        changed_by_name=changed_by_name,
        notes=item.notes,
        created_at=item.created_at,
    )
