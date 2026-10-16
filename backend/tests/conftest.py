import pytest
import pytest_asyncio
import uuid
from typing import AsyncGenerator
from httpx import AsyncClient, ASGITransport

from main import app
from app.core.database import SessionLocal
from app.models.user import User
from app.core.security import create_access_token
from app.core.permissions import UserRoleEnum


@pytest_asyncio.fixture(scope="function")
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Async HTTP test client fixture."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture(scope="function")
async def test_users():
    """Create fresh test buyer A, buyer B, vendor A, vendor B, and admin with auth cookies."""
    async with SessionLocal() as db:
        buyer_id = uuid.uuid4()
        buyer_b_id = uuid.uuid4()
        vendor_a_id = uuid.uuid4()
        vendor_b_id = uuid.uuid4()
        admin_id = uuid.uuid4()

        buyer = User(
            id=buyer_id,
            first_name="TestBuyer",
            email=f"tb_{buyer_id.hex[:6]}@buyer.com",
            role=UserRoleEnum.BUYER.value,
            email_verified=True,
        )
        buyer_b = User(
            id=buyer_b_id,
            first_name="TestBuyerBeta",
            email=f"tbb_{buyer_b_id.hex[:6]}@buyer.com",
            role=UserRoleEnum.BUYER.value,
            email_verified=True,
        )
        vendor_a = User(
            id=vendor_a_id,
            first_name="VendorAlpha",
            email=f"va_{vendor_a_id.hex[:6]}@vendor.com",
            role=UserRoleEnum.VENDOR.value,
            email_verified=True,
        )
        vendor_b = User(
            id=vendor_b_id,
            first_name="VendorBeta",
            email=f"vb_{vendor_b_id.hex[:6]}@vendor.com",
            role=UserRoleEnum.VENDOR.value,
            email_verified=True,
        )
        admin = User(
            id=admin_id,
            first_name="TestAdmin",
            email=f"ta_{admin_id.hex[:6]}@admin.com",
            role=UserRoleEnum.ADMIN.value,
            email_verified=True,
        )
        db.add_all([buyer, buyer_b, vendor_a, vendor_b, admin])
        await db.commit()

    buyer_token = create_access_token({"sub": str(buyer_id)})
    buyer_b_token = create_access_token({"sub": str(buyer_b_id)})
    vendor_a_token = create_access_token({"sub": str(vendor_a_id)})
    vendor_b_token = create_access_token({"sub": str(vendor_b_id)})
    admin_token = create_access_token({"sub": str(admin_id)})

    return {
        "buyer": {"id": buyer_id, "cookies": {"access_token": f"Bearer {buyer_token}"}},
        "buyer_b": {"id": buyer_b_id, "cookies": {"access_token": f"Bearer {buyer_b_token}"}},
        "vendor_a": {"id": vendor_a_id, "cookies": {"access_token": f"Bearer {vendor_a_token}"}},
        "vendor_b": {"id": vendor_b_id, "cookies": {"access_token": f"Bearer {vendor_b_token}"}},
        "admin": {"id": admin_id, "cookies": {"access_token": f"Bearer {admin_token}"}},
    }

