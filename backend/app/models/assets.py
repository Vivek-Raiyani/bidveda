from sqlalchemy import Column, String, Integer, ForeignKey, UUID
from sqlalchemy.orm import relationship
from app.models.base import Base


class Asset(Base):
    __tablename__ = "assets"

    # Who uploaded this asset
    uploaded_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Logical grouping (e.g. "assets/profile", "assets/documents")
    folder = Column(String, nullable=False, default="assets/common")

    # Original filename as uploaded
    filename = Column(String, nullable=False)

    # The storage key / relative path used to identify the object in storage
    # e.g. "users/<uuid>/assets/profile/avatar.png"
    storage_key = Column(String, nullable=False, unique=True)

    # Persisted public/presigned URL — regenerate from storage_key when stale
    file_url = Column(String, nullable=True)

    # Optional metadata
    content_type = Column(String, nullable=True)
    file_size = Column(Integer, nullable=True)
    status = Column(String, default="completed", nullable=False)


    # Relationships
    uploader = relationship("User", foreign_keys=[uploaded_by], lazy="select")
    