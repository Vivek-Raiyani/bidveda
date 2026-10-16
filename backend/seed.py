import asyncio
import uuid
from decimal import Decimal
from datetime import datetime, timezone, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import SessionLocal, engine
from app.models.user import User
from app.models.request_quote import RFQ, RFQLineItem, RFQStatus
from app.models.quote import Quote, QuoteItem, QuoteStatus
from app.core.security import get_password_hash
from app.core.permissions import UserRoleEnum


async def get_or_create_user(
    db: AsyncSession,
    email: str,
    password: str,
    first_name: str,
    last_name: str,
    role: UserRoleEnum,
) -> User:
    """Helper to fetch an existing user by email or create them with hashed password."""
    stmt = select(User).where(User.email == email)
    res = await db.execute(stmt)
    user = res.scalars().first()

    if not user:
        user = User(
            id=uuid.uuid4(),
            email=email,
            hashed_password=get_password_hash(password),
            first_name=first_name,
            last_name=last_name,
            role=role.value,
            email_verified=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        print(f" [+] Created user: {email} ({role.value})")
    else:
        print(f" [=] User already exists: {email} ({role.value})")

    return user


async def seed():
    """Seed the database with initial users, sample RFQs, line items, and quotes."""
    print("=" * 60)
    print("Seeding Bidveda Mini RFQ Portal Database...")
    print("=" * 60)

    async with SessionLocal() as db:
        # 1. Seed Users
        password = "Password123!"

        buyer = await get_or_create_user(
            db=db,
            email="buyer@bidveda.in",
            password=password,
            first_name="Acme",
            last_name="Constructions",
            role=UserRoleEnum.BUYER,
        )

        vendor1 = await get_or_create_user(
            db=db,
            email="vendor1@bidveda.in",
            password=password,
            first_name="Vendor",
            last_name="Alpha",
            role=UserRoleEnum.VENDOR,
        )

        vendor2 = await get_or_create_user(
            db=db,
            email="vendor2@bidveda.in",
            password=password,
            first_name="Vendor",
            last_name="Beta",
            role=UserRoleEnum.VENDOR,
        )

        admin = await get_or_create_user(
            db=db,
            email="admin@bidveda.in",
            password=password,
            first_name="System",
            last_name="Admin",
            role=UserRoleEnum.ADMIN,
        )

        # 2. Seed Sample Published RFQ (from assignment problem statement)
        rfq1_title = "Office supplies for Hyderabad site"
        stmt = select(RFQ).where(RFQ.title == rfq1_title, RFQ.buyer_id == buyer.id)
        res = await db.execute(stmt)
        rfq1 = res.scalars().first()

        if not rfq1:
            rfq1 = RFQ(
                id=uuid.uuid4(),
                buyer_id=buyer.id,
                title=rfq1_title,
                description="Procurement of ergonomic office chairs and executive desks for new Hyderabad branch.",
                category="Office Supplies",
                delivery_location="Hyderabad",
                budget=Decimal("400000.00"),
                deadline=datetime.now(timezone.utc) + timedelta(days=10),
                status=RFQStatus.PUBLISHED.value,
            )
            db.add(rfq1)
            await db.flush()

            chair_item = RFQLineItem(
                id=uuid.uuid4(),
                rfq_id=rfq1.id,
                name="Chairs",
                quantity=Decimal("100"),
                unit="chairs",
            )
            desk_item = RFQLineItem(
                id=uuid.uuid4(),
                rfq_id=rfq1.id,
                name="Desks",
                quantity=Decimal("20"),
                unit="desks",
            )
            db.add_all([chair_item, desk_item])
            await db.flush()
            print(f" [+] Created published RFQ: '{rfq1.title}' with 2 line items")

            # 3. Seed Quotes for RFQ 1
            # Quote 1: Vendor Alpha (350,000, 10 days, Version 2)
            quote1 = Quote(
                id=uuid.uuid4(),
                rfq_id=rfq1.id,
                vendor_id=vendor1.id,
                version=2,
                delivery_days=10,
                notes="Revised quote with 5% volume discount applied on chair units.",
                total_amount=Decimal("350000.00"),
                status=QuoteStatus.SUBMITTED.value,
            )
            db.add(quote1)
            await db.flush()

            q1_item1 = QuoteItem(
                id=uuid.uuid4(),
                quote_id=quote1.id,
                line_item_id=chair_item.id,
                unit_price=Decimal("1900.00"),
                total_price=Decimal("190000.00"),
            )
            q1_item2 = QuoteItem(
                id=uuid.uuid4(),
                quote_id=quote1.id,
                line_item_id=desk_item.id,
                unit_price=Decimal("8000.00"),
                total_price=Decimal("160000.00"),
            )
            db.add_all([q1_item1, q1_item2])
            print(f" [+] Created Quote from Vendor Alpha (Total: 350,000, 10 days)")

            # Quote 2: Vendor Beta (360,000, 7 days, Version 1)
            quote2 = Quote(
                id=uuid.uuid4(),
                rfq_id=rfq1.id,
                vendor_id=vendor2.id,
                version=1,
                delivery_days=7,
                notes="Express delivery guaranteed within 7 business days from order placement.",
                total_amount=Decimal("360000.00"),
                status=QuoteStatus.SUBMITTED.value,
            )
            db.add(quote2)
            await db.flush()

            q2_item1 = QuoteItem(
                id=uuid.uuid4(),
                quote_id=quote2.id,
                line_item_id=chair_item.id,
                unit_price=Decimal("2200.00"),
                total_price=Decimal("220000.00"),
            )
            q2_item2 = QuoteItem(
                id=uuid.uuid4(),
                quote_id=quote2.id,
                line_item_id=desk_item.id,
                unit_price=Decimal("7000.00"),
                total_price=Decimal("140000.00"),
            )
            db.add_all([q2_item1, q2_item2])
            print(f" [+] Created Quote from Vendor Beta (Total: 360,000, 7 days)")

        else:
            print(f" [=] Sample RFQ already exists: '{rfq1.title}'")

        # 4. Seed Sample Draft RFQ
        rfq2_title = "IT Equipment for Bangalore site"
        stmt2 = select(RFQ).where(RFQ.title == rfq2_title, RFQ.buyer_id == buyer.id)
        res2 = await db.execute(stmt2)
        rfq2 = res2.scalars().first()

        if not rfq2:
            rfq2 = RFQ(
                id=uuid.uuid4(),
                buyer_id=buyer.id,
                title=rfq2_title,
                description="Laptops and 4K external monitors for engineering department.",
                category="IT Hardware",
                delivery_location="Bangalore",
                budget=Decimal("850000.00"),
                deadline=datetime.now(timezone.utc) + timedelta(days=20),
                status=RFQStatus.DRAFT.value,
            )
            db.add(rfq2)
            await db.flush()

            laptop_item = RFQLineItem(
                id=uuid.uuid4(),
                rfq_id=rfq2.id,
                name="Developer Laptops (32GB RAM)",
                quantity=Decimal("15"),
                unit="units",
            )
            monitor_item = RFQLineItem(
                id=uuid.uuid4(),
                rfq_id=rfq2.id,
                name="27-inch 4K Monitors",
                quantity=Decimal("25"),
                unit="units",
            )
            db.add_all([laptop_item, monitor_item])
            print(f" [+] Created draft RFQ: '{rfq2.title}' with 2 line items")
        else:
            print(f" [=] Draft RFQ already exists: '{rfq2.title}'")

        await db.commit()

    print("=" * 60)
    print("Database seeding completed successfully!")
    print("Sample Credentials:")
    print("  Buyer:   buyer@bidveda.in   / Password123!")
    print("  Vendor1: vendor1@bidveda.in / Password123!")
    print("  Vendor2: vendor2@bidveda.in / Password123!")
    print("  Admin:   admin@bidveda.in   / Password123!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(seed())

"""
============================================================
Database seeding completed successfully!
Sample Credentials:
  Buyer:   buyer@bidveda.in   / Password123!
  Vendor1: vendor1@bidveda.in / Password123!
  Vendor2: vendor2@bidveda.in / Password123!
  Admin:   admin@bidveda.in   / Password123!
============================================================
"""
