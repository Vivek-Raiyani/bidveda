from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from fastapi import HTTPException, UploadFile
import uuid

from app.models.assets import Asset
from app.models.user import User
from app.utils.storage import storage, LocalStorageProvider, CloudStorageProvider
from app.core.config import settings

import os
import logging
import mimetypes

logger = logging.getLogger(__name__)

MIME_TO_EXT = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "application/pdf": ".pdf",
    "video/mp4": ".mp4",
    "audio/mpeg": ".mp3",
    "text/plain": ".txt",
    "text/csv": ".csv",
    "application/json": ".json",
}

def _resolve_filename_and_ext(filename: str, content_type: str | None = None) -> tuple[str, str]:
    """Extract file stem and extension; infer extension from content_type if missing."""
    original_filename = os.path.basename(filename or "file")
    name, ext = os.path.splitext(original_filename)
    if not ext and content_type:
        clean_ct = content_type.split(";")[0].strip().lower()
        ext = MIME_TO_EXT.get(clean_ct) or mimetypes.guess_extension(clean_ct) or ""
    return name, ext.lower()

async def upload_asset(
    db: AsyncSession,
    user_id: uuid.UUID,
    file: UploadFile,
    folder: str = "assets/common",
) -> Asset:
    """Upload a file through the API server and persist its asset record."""

    content_type = file.content_type or ""
    file_bytes = await file.read()
    file_size = len(file_bytes)
    name, ext = _resolve_filename_and_ext(file.filename or "file", content_type)

    unique_filename = f"{name}_{uuid.uuid4().hex}{ext}"
    storage_key, file_url = await storage.upload_file(
        str(user_id), folder, unique_filename, file_bytes
    )
    asset = Asset(
        uploaded_by=user_id,
        folder=folder,
        filename=unique_filename,
        storage_key=storage_key,
        file_url=file_url,
        content_type=content_type,
        file_size=file_size,
        status="completed",
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return asset

async def request_upload_url(
    db: AsyncSession,
    user_id: uuid.UUID,
    filename: str,
    content_type: str,
    file_size: int,
    folder: str = "assets/common",
) -> tuple[Asset, str, dict, str]:
    """
    Generates a presigned URL (or local upload URL) for direct upload.
    Creates an Asset record in 'pending' status.
    """
    name, ext = _resolve_filename_and_ext(filename or "file", content_type)

    unique_filename = f"{name}_{uuid.uuid4().hex}{ext}"

    storage_key, upload_url, fields = await storage.generate_upload_url(
        str(user_id), folder, unique_filename, file_size
    )

    asset = Asset(
        uploaded_by=user_id,
        folder=folder,
        filename=unique_filename,
        storage_key=storage_key,
        # For local, URL will be updated upon completion. For S3, we know it now.
        file_url=await storage.get_file_url(storage_key) if storage.provider == "s3" else "",
        content_type=content_type,
        file_size=file_size,
        status="pending"
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    
    # If local, append asset_id to the URL for the local-upload handler
    if storage.provider == "local":
        upload_url = f"{upload_url}/{asset.id}"

    return asset, upload_url, fields, storage.provider

async def complete_local_upload(
    db: AsyncSession,
    user_id: uuid.UUID,
    asset_id: uuid.UUID,
    file: UploadFile
) -> Asset:
    """
    Handles the actual file upload for the local storage fallback.
    """
    result = await db.execute(
        select(Asset).where(Asset.id == asset_id, Asset.uploaded_by == user_id, Asset.status == "pending")
    )
    asset = result.scalars().first()
    if not asset:
        raise HTTPException(status_code=404, detail="Pending asset not found")

    if storage.provider != "local":
        raise HTTPException(status_code=400, detail="Local upload called but storage provider is not local")

    file_bytes = await file.read()

    # If storage_key was originally created without an extension, infer it now:
    _, current_ext = os.path.splitext(asset.storage_key)
    if not current_ext:
        detected_ext = _resolve_filename_and_ext(file.filename or "", file.content_type or asset.content_type)[1]
        if detected_ext:
            asset.storage_key = f"{asset.storage_key}{detected_ext}"
            asset.filename = f"{asset.filename}{detected_ext}"

    asset.file_url = await storage.write_to_key(asset.storage_key, file_bytes)
    asset.status = "completed"
    asset.file_size = len(file_bytes)
    
    await db.commit()
    await db.refresh(asset)
    return asset
    
async def complete_cloud_upload(
    db: AsyncSession,
    user_id: uuid.UUID,
    asset_id: uuid.UUID
) -> Asset:
    """
    Marks a cloud upload as completed and updates quota.
    """
    result = await db.execute(
        select(Asset).where(Asset.id == asset_id, Asset.uploaded_by == user_id, Asset.status == "pending")
    )
    asset = result.scalars().first()
    if not asset:
        raise HTTPException(status_code=404, detail="Pending asset not found")

    if storage.provider != "s3":
        raise HTTPException(status_code=400, detail="Cloud completion is only available for cloud storage")
    
    try:
        file_size = await storage.verify_upload(asset.storage_key)
    except Exception as exc:
        logger.warning("Could not verify uploaded object %s: %s", asset.storage_key, exc)
        raise HTTPException(status_code=400, detail="Uploaded object was not found in cloud storage") from exc
    
    asset.file_size = file_size
    asset.status = "completed"
    
    await db.commit()
    await db.refresh(asset)
    return asset


async def delete_asset(
    db: AsyncSession,
    user_id: uuid.UUID,
    asset_id: uuid.UUID,
) -> None:
    """
    Looks up the Asset record by ID, deletes the file from storage using the
    persisted storage_key, then removes the DB record.
    Raises 404 if the asset doesn't exist or doesn't belong to the user.
    """
    logger.info(f"Deleting asset {asset_id} for user {user_id}")
    result = await db.execute(
        select(Asset).where(Asset.id == asset_id, Asset.uploaded_by == user_id)
    )
    asset = result.scalars().first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    await storage.delete_file(asset.storage_key)
    
    await db.delete(asset)
    await db.commit()


async def get_asset_url(
    db: AsyncSession,
    user_id: uuid.UUID,
    asset_id: uuid.UUID,
) -> str:
    """
    Returns a fresh URL for the asset (presigned for cloud, static for local).
    For cloud storage the presigned URL is regenerated on each call so clients
    always get a valid, unexpired link.
    """
    logger.info(f"Getting URL for asset {asset_id} (user {user_id})")
    result = await db.execute(
        select(Asset).where(Asset.id == asset_id, Asset.uploaded_by == user_id)
    )
    asset = result.scalars().first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if asset.status != "completed":
        raise HTTPException(status_code=400, detail="Asset upload is not yet completed")

    return await storage.get_file_url(asset.storage_key)


async def list_assets(
    db: AsyncSession,
    user_id: uuid.UUID,
    folder: str | None = None,
) -> list[Asset]:
    """
    Lists all Asset records for the user, optionally filtered by folder.
    """
    logger.info(f"Listing assets for user {user_id} (folder: {folder})")
    query = select(Asset).where(Asset.uploaded_by == user_id)
    if folder:
        query = query.where(Asset.folder.like(f"assets/{folder}%"))
    query = query.order_by(Asset.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()
