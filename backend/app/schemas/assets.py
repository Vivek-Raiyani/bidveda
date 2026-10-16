from typing import Optional, Dict, Any
from pydantic import BaseModel, ConfigDict
import uuid
from datetime import datetime

class AssetUploadRequest(BaseModel):
    filename: str
    content_type: str
    file_size: int
    folder: str = "assets/common"

class AssetPresignedResponse(BaseModel):
    asset_id: uuid.UUID
    upload_url: str
    fields: Dict[str, Any]
    provider: str

class AssetResponse(BaseModel):
    id: uuid.UUID
    filename: str
    folder: str
    file_url: Optional[str] = None
    content_type: Optional[str] = None
    file_size: Optional[int] = None
    created_at: datetime
    status: str

    model_config = ConfigDict(from_attributes=True)

class AssetUploadResponse(BaseModel):
    id: uuid.UUID
    url: Optional[str] = None
    filename: str

    model_config = ConfigDict(from_attributes=True)
