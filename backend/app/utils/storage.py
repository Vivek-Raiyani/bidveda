import os
import asyncio
from abc import ABC, abstractmethod
from app.core.config import settings


class StorageProvider(ABC):
    """Abstract base class for all storage providers.

    All methods are async coroutines so callers can await them directly
    without worrying about whether the underlying implementation is blocking
    (local disk I/O, boto3 network calls, etc.). Each concrete provider is
    responsible for running its own blocking code in a thread via
    asyncio.to_thread.
    """

    # Concrete providers must set this to identify themselves (e.g. "local", "s3")
    provider: str

    @abstractmethod
    async def upload_file(self, user_id: str, service: str, filename: str, file_bytes: bytes) -> tuple[str, str]:
        """
        Uploads a file and returns (storage_key, file_url).
        storage_key is the stable identifier used for deletes;
        file_url is the URL clients can use to access the file.
        """

    @abstractmethod
    async def generate_upload_url(
        self, user_id: str, service: str, filename: str, file_size: int
    ) -> tuple[str, str, dict]:
        """
        Generates a URL (and optional POST fields) for direct client upload.
        Returns (storage_key, upload_url, fields_dict).
        """
    
    @abstractmethod
    async def write_to_key(self, storage_key: str, file_bytes: bytes) -> str:
        """
        Writes bytes directly to a pre-reserved storage key and returns the URL.
        Used by the local-upload fallback where the key was already determined
        during generate_upload_url and must not be regenerated.
        """

    @abstractmethod
    async def verify_upload(self, storage_key: str) -> int:
        """
        Verifies that a file was actually uploaded and returns its byte size.
        Raises an exception if the object is not found.
        Used by the cloud/local completion flow.
        """

    @abstractmethod
    async def get_file_url(self, storage_key: str) -> str:
        """
        Returns the URL to access the file.
        For cloud providers this generates a fresh presigned URL on each call.
        For local storage this returns a static URL.
        """
    
    @abstractmethod
    async def delete_file(self, storage_key: str) -> bool:
        """Deletes a file by its storage key. Returns True on success."""



# ---------------------------------------------------------------------------
# Local filesystem provider
# ---------------------------------------------------------------------------

class LocalStorageProvider(StorageProvider):
    """Stores files on the local filesystem under base_dir."""

    provider = "local"

    def __init__(self, base_dir: str = "media") -> None:
        self.base_dir = base_dir
        os.makedirs(self.base_dir, exist_ok=True)

    def _storage_key(self, user_id: str, service: str, filename: str) -> str:
        return f"users/{user_id}/{service}/{filename}"

    async def upload_file(self, user_id: str, service: str, filename: str, file_bytes: bytes) -> tuple[str, str]:
        key = self._storage_key(user_id, service, filename)
        file_path = os.path.join(self.base_dir, key)

        def _write() -> None:
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            with open(file_path, "wb") as fh:
                fh.write(file_bytes)

        await asyncio.to_thread(_write)
        return key, await self.get_file_url(key)

    async def delete_file(self, storage_key: str) -> bool:
        file_path = os.path.join(self.base_dir, storage_key)

        def _delete() -> bool:
            if os.path.exists(file_path):
                os.remove(file_path)
                return True
            return False

        return await asyncio.to_thread(_delete)

    async def get_file_url(self, storage_key: str) -> str:
        # Pure string formatting - no I/O needed.
        return f"{settings.SERVER_HOST.rstrip('/')}/{self.base_dir}/{storage_key}"

    async def generate_upload_url(
        self, user_id: str, service: str, filename: str, file_size: int
    ) -> tuple[str, str, dict]:
        key = self._storage_key(user_id, service, filename)
        # Return a URL pointing at our own local-upload handler.
        # The service appends the asset_id after it receives the asset record.
        upload_url = f"{settings.SERVER_HOST.rstrip('/')}/api/assets/upload/local"
        return key, upload_url, {}

    async def verify_upload(self, storage_key: str) -> int:
        """Verify the file exists on disk and return its byte size."""
        file_path = os.path.join(self.base_dir, storage_key)

        def _stat() -> int:
            return os.path.getsize(file_path)  # raises FileNotFoundError if missing

        return await asyncio.to_thread(_stat)

    async def write_to_key(self, storage_key: str, file_bytes: bytes) -> str:
        """Write bytes to a pre-reserved storage key and return its URL."""
        file_path = os.path.join(self.base_dir, storage_key)

        def _write() -> None:
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            with open(file_path, "wb") as fh:
                fh.write(file_bytes)

        await asyncio.to_thread(_write)
        return await self.get_file_url(storage_key)


# ---------------------------------------------------------------------------
# AWS S3 (or S3-compatible) cloud provider
# ---------------------------------------------------------------------------

class CloudStorageProvider(StorageProvider):
    """Stores files in S3 via presigned URLs; uses asyncio.to_thread
    for every boto3 call so the event loop is never blocked."""

    provider = "s3"

    def __init__(self, presigned_expiry: int = 3600) -> None:
        import boto3
        from botocore.config import Config

        if not all([
            settings.AWS_ENDPOINT,
            settings.AWS_ACCESS_KEY_ID,
            settings.AWS_SECRET_ACCESS_KEY,
            settings.AWS_REGION_NAME,
            settings.AWS_BUCKET_NAME,
        ]):
            raise ValueError("Missing AWS S3 configuration in settings")

        self.bucket_name = settings.AWS_BUCKET_NAME
        self.region = settings.AWS_REGION_NAME
        self.presigned_expiry = presigned_expiry

        self.s3_client = boto3.client(
            "s3",
            endpoint_url=settings.AWS_ENDPOINT,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=self.region,
            config=Config(signature_version="s3v4"),
        )

    def _storage_key(self, user_id: str, service: str, filename: str) -> str:
        return f"users/{user_id}/{service}/{filename}"

    async def upload_file(self, user_id: str, service: str, filename: str, file_bytes: bytes) -> tuple[str, str]:
        key = self._storage_key(user_id, service, filename)
        await asyncio.to_thread(
            self.s3_client.put_object,
            Bucket=self.bucket_name,
            Key=key,
            Body=file_bytes,
        )
        return key, await self.get_file_url(key)

    async def delete_file(self, storage_key: str) -> bool:
        await asyncio.to_thread(
            self.s3_client.delete_object,
            Bucket=self.bucket_name,
            Key=storage_key,
        )
        return True

    async def get_file_url(self, storage_key: str) -> str:
        # generate_presigned_url is pure signing (CPU-only), but we offload it
        # to keep the pattern consistent and future-proof.
        return await asyncio.to_thread(
            self.s3_client.generate_presigned_url,
            "get_object",
            Params={"Bucket": self.bucket_name, "Key": storage_key},
            ExpiresIn=self.presigned_expiry,
        )

    async def generate_upload_url(
        self, user_id: str, service: str, filename: str, file_size: int
    ) -> tuple[str, str, dict]:
        key = self._storage_key(user_id, service, filename)
        upload_url = await asyncio.to_thread(
            self.s3_client.generate_presigned_url,
            "put_object",
            Params={"Bucket": self.bucket_name, "Key": key},
            ExpiresIn=self.presigned_expiry,
        )
        return key, upload_url, {}

    async def verify_upload(self, storage_key: str) -> int:
        """Calls head_object to confirm the object exists and return its size."""
        response = await asyncio.to_thread(
            self.s3_client.head_object,
            Bucket=self.bucket_name,
            Key=storage_key,
        )
        return response["ContentLength"]

    async def write_to_key(self, storage_key: str, file_bytes: bytes) -> str:
        """Write bytes to a pre-reserved S3 key and return its URL."""
        await asyncio.to_thread(
            self.s3_client.put_object,
            Bucket=self.bucket_name,
            Key=storage_key,
            Body=file_bytes,
        )
        return await self.get_file_url(storage_key)


# ---------------------------------------------------------------------------
# Google Drive stub (not yet implemented)
# ---------------------------------------------------------------------------

class GDriveStorageProvider(StorageProvider):
    provider = "gdrive"
    
    async def upload_file(self, user_id: str, service: str, filename: str, file_bytes: bytes) -> tuple[str, str]:
        raise NotImplementedError

    async def delete_file(self, storage_key: str) -> bool:
        raise NotImplementedError

    async def get_file_url(self, storage_key: str) -> str:
        raise NotImplementedError

    async def generate_upload_url(
        self, user_id: str, service: str, filename: str, file_size: int
    ) -> tuple[str, str, dict]:
        raise NotImplementedError

    async def verify_upload(self, storage_key: str) -> int:
        raise NotImplementedError

    async def write_to_key(self, storage_key: str, file_bytes: bytes) -> str:
        raise NotImplementedError


# ---------------------------------------------------------------------------
# Factory + module-level singleton
# ---------------------------------------------------------------------------

def get_storage_provider() -> StorageProvider:
    """Returns the configured storage provider."""
    provider = getattr(settings, "STORAGE_PROVIDER", "local").lower()
    if provider == "local":
        return LocalStorageProvider()
    elif provider == "s3":
        return CloudStorageProvider()
    else:
        raise ValueError(f"Unsupported storage provider: {provider}")


# Import and use anywhere:
#   from app.utils.storage import storage
#   key, url = await storage.upload_file(user_id, service, filename, file_bytes)
storage = get_storage_provider()
