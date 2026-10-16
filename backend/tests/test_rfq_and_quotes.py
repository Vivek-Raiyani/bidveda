import pytest
import uuid
from decimal import Decimal
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient

from app.core.database import SessionLocal
from app.models.request_quote import RFQ, RFQStatus


@pytest.mark.asyncio
async def test_submit_quote_before_deadline_success(client: AsyncClient, test_users: dict):
    """Test that a vendor can successfully submit a quote with per-line pricing before deadline."""
    buyer = test_users["buyer"]
    vendor_a = test_users["vendor_a"]

    # 1. Buyer creates and publishes RFQ
    future_deadline = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    rfq_payload = {
        "title": "Office Chairs for Site",
        "category": "Furniture",
        "delivery_location": "Hyderabad",
        "budget": 200000.0,
        "deadline": future_deadline,
        "line_items": [
            {"name": "Office Chairs", "quantity": 100, "unit": "chairs"},
        ],
    }
    create_res = await client.post("/api/rfqs", json=rfq_payload, cookies=buyer["cookies"])
    assert create_res.status_code == 201
    rfq = create_res.json()["data"]
    rfq_id = rfq["id"]
    line_item_id = rfq["line_items"][0]["id"]

    pub_res = await client.post(f"/api/rfqs/{rfq_id}/publish", cookies=buyer["cookies"])
    assert pub_res.status_code == 200

    # 2. Vendor submits quote before deadline
    quote_payload = {
        "delivery_days": 10,
        "notes": "Standard proposal",
        "items": [
            {"line_item_id": line_item_id, "unit_price": 1800.0},
        ],
    }
    quote_res = await client.post(f"/api/rfqs/{rfq_id}/quotes", json=quote_payload, cookies=vendor_a["cookies"])
    assert quote_res.status_code == 201
    quote = quote_res.json()["data"]
    assert quote["version"] == 1
    assert quote["status"] == "submitted"
    assert float(quote["total_amount"]) == 180000.0  # 100 * 1800
    assert quote["delivery_days"] == 10


@pytest.mark.asyncio
async def test_reject_quote_submission_after_deadline(client: AsyncClient, test_users: dict):
    """Test that quote submissions are strictly rejected once the RFQ deadline has passed."""
    buyer = test_users["buyer"]
    vendor_a = test_users["vendor_a"]

    # 1. Buyer creates and publishes RFQ
    rfq_payload = {
        "title": "Expired RFQ Test",
        "category": "Office Supplies",
        "delivery_location": "Hyderabad",
        "deadline": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "line_items": [
            {"name": "Paper Reams", "quantity": 50, "unit": "boxes"},
        ],
    }
    create_res = await client.post("/api/rfqs", json=rfq_payload, cookies=buyer["cookies"])
    rfq_id = create_res.json()["data"]["id"]
    line_item_id = create_res.json()["data"]["line_items"][0]["id"]
    await client.post(f"/api/rfqs/{rfq_id}/publish", cookies=buyer["cookies"])

    # 2. Manually expire deadline in DB
    async with SessionLocal() as db:
        rfq_obj = await db.get(RFQ, uuid.UUID(rfq_id))
        rfq_obj.deadline = datetime.now(timezone.utc) - timedelta(hours=2)
        await db.commit()

    # 3. Vendor attempts to submit quote after deadline -> Should fail with 400
    quote_payload = {
        "delivery_days": 5,
        "items": [
            {"line_item_id": line_item_id, "unit_price": 500.0},
        ],
    }
    res = await client.post(f"/api/rfqs/{rfq_id}/quotes", json=quote_payload, cookies=vendor_a["cookies"])
    assert res.status_code == 400
    assert "deadline" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_vendor_revising_quote(client: AsyncClient, test_users: dict):
    """Test that a vendor can revise their quote before the deadline and version increments."""
    buyer = test_users["buyer"]
    vendor_a = test_users["vendor_a"]

    # 1. Setup RFQ
    rfq_payload = {
        "title": "Revision Test RFQ",
        "category": "IT",
        "delivery_location": "Hyderabad",
        "deadline": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "line_items": [
            {"name": "Keyboards", "quantity": 10, "unit": "units"},
        ],
    }
    create_res = await client.post("/api/rfqs", json=rfq_payload, cookies=buyer["cookies"])
    rfq_id = create_res.json()["data"]["id"]
    item_id = create_res.json()["data"]["line_items"][0]["id"]
    await client.post(f"/api/rfqs/{rfq_id}/publish", cookies=buyer["cookies"])

    # 2. Initial quote: 10 * 1500 = 15,000
    q_res = await client.post(
        f"/api/rfqs/{rfq_id}/quotes",
        json={"delivery_days": 5, "items": [{"line_item_id": item_id, "unit_price": 1500.0}]},
        cookies=vendor_a["cookies"],
    )
    quote_id = q_res.json()["data"]["id"]
    assert q_res.json()["data"]["version"] == 1
    assert float(q_res.json()["data"]["total_amount"]) == 15000.0

    # 3. Revise quote: price reduced to 1200 -> Total = 12,000, version = 2
    rev_payload = {
        "delivery_days": 4,
        "notes": "Discounted price",
        "items": [{"line_item_id": item_id, "unit_price": 1200.0}],
    }
    rev_res = await client.put(f"/api/quotes/{quote_id}", json=rev_payload, cookies=vendor_a["cookies"])
    assert rev_res.status_code == 200
    rev_data = rev_res.json()["data"]
    assert rev_data["version"] == 2
    assert float(rev_data["total_amount"]) == 12000.0
    assert rev_data["delivery_days"] == 4


@pytest.mark.asyncio
async def test_reject_quote_revision_after_deadline(client: AsyncClient, test_users: dict):
    """Test that quote revisions are rejected if deadline has elapsed."""
    buyer = test_users["buyer"]
    vendor_a = test_users["vendor_a"]

    # 1. Setup RFQ & initial quote
    rfq_payload = {
        "title": "Revision Deadline Test",
        "category": "Hardware",
        "delivery_location": "Hyderabad",
        "deadline": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
        "line_items": [{"name": "Cables", "quantity": 100, "unit": "units"}],
    }
    create_res = await client.post("/api/rfqs", json=rfq_payload, cookies=buyer["cookies"])
    rfq_id = create_res.json()["data"]["id"]
    item_id = create_res.json()["data"]["line_items"][0]["id"]
    await client.post(f"/api/rfqs/{rfq_id}/publish", cookies=buyer["cookies"])

    q_res = await client.post(
        f"/api/rfqs/{rfq_id}/quotes",
        json={"delivery_days": 3, "items": [{"line_item_id": item_id, "unit_price": 100.0}]},
        cookies=vendor_a["cookies"],
    )
    quote_id = q_res.json()["data"]["id"]

    # 2. Expire deadline
    async with SessionLocal() as db:
        rfq_obj = await db.get(RFQ, uuid.UUID(rfq_id))
        rfq_obj.deadline = datetime.now(timezone.utc) - timedelta(minutes=10)
        await db.commit()

    # 3. Attempt revision -> 400 Bad Request
    rev_res = await client.put(
        f"/api/quotes/{quote_id}",
        json={"delivery_days": 2, "items": [{"line_item_id": item_id, "unit_price": 90.0}]},
        cookies=vendor_a["cookies"],
    )
    assert rev_res.status_code == 400
    assert "deadline" in rev_res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_award_flow_status_transitions(client: AsyncClient, test_users: dict):
    """
    Test the full award flow status transitions:
    - Winning quote becomes 'accepted'
    - Other quotes become 'rejected'
    - RFQ becomes 'awarded'
    """
    buyer = test_users["buyer"]
    vendor_a = test_users["vendor_a"]
    vendor_b = test_users["vendor_b"]

    # 1. Setup RFQ
    rfq_payload = {
        "title": "Award Flow Test RFQ",
        "category": "Office",
        "delivery_location": "Hyderabad",
        "deadline": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat(),
        "line_items": [{"name": "Desks", "quantity": 10, "unit": "desks"}],
    }
    create_res = await client.post("/api/rfqs", json=rfq_payload, cookies=buyer["cookies"])
    rfq_id = create_res.json()["data"]["id"]
    item_id = create_res.json()["data"]["line_items"][0]["id"]
    await client.post(f"/api/rfqs/{rfq_id}/publish", cookies=buyer["cookies"])

    # 2. Vendor A quotes
    res_qa = await client.post(
        f"/api/rfqs/{rfq_id}/quotes",
        json={"delivery_days": 10, "items": [{"line_item_id": item_id, "unit_price": 5000.0}]},
        cookies=vendor_a["cookies"],
    )
    quote_a_id = res_qa.json()["data"]["id"]

    # 3. Vendor B quotes
    res_qb = await client.post(
        f"/api/rfqs/{rfq_id}/quotes",
        json={"delivery_days": 5, "items": [{"line_item_id": item_id, "unit_price": 5500.0}]},
        cookies=vendor_b["cookies"],
    )
    quote_b_id = res_qb.json()["data"]["id"]

    # 4. Buyer awards RFQ to Vendor B
    award_res = await client.post(
        f"/api/rfqs/{rfq_id}/award",
        json={"quote_id": quote_b_id, "notes": "Preferred faster delivery"},
        cookies=buyer["cookies"],
    )
    assert award_res.status_code == 200
    assert award_res.json()["data"]["status"] == "awarded"
    assert award_res.json()["data"]["awarded_quote_id"] == quote_b_id

    # 5. Verify Quote and RFQ statuses
    rfq_res = await client.get(f"/api/rfqs/{rfq_id}", cookies=buyer["cookies"])
    assert rfq_res.json()["data"]["status"] == "awarded"

    qa_res = await client.get(f"/api/quotes/{quote_a_id}", cookies=buyer["cookies"])
    assert qa_res.json()["data"]["status"] == "rejected"

    qb_res = await client.get(f"/api/quotes/{quote_b_id}", cookies=buyer["cookies"])
    assert qb_res.json()["data"]["status"] == "accepted"


@pytest.mark.asyncio
async def test_vendor_isolation_security(client: AsyncClient, test_users: dict):
    """Test strict vendor isolation: Vendor A cannot view Vendor B's quote and vice versa."""
    buyer = test_users["buyer"]
    vendor_a = test_users["vendor_a"]
    vendor_b = test_users["vendor_b"]

    rfq_payload = {
        "title": "Isolation Security Test",
        "category": "Security",
        "delivery_location": "Hyderabad",
        "deadline": (datetime.now(timezone.utc) + timedelta(days=5)).isoformat(),
        "line_items": [{"name": "Monitors", "quantity": 5, "unit": "units"}],
    }
    create_res = await client.post("/api/rfqs", json=rfq_payload, cookies=buyer["cookies"])
    rfq_id = create_res.json()["data"]["id"]
    item_id = create_res.json()["data"]["line_items"][0]["id"]
    await client.post(f"/api/rfqs/{rfq_id}/publish", cookies=buyer["cookies"])

    # Vendor A submits quote
    res_qa = await client.post(
        f"/api/rfqs/{rfq_id}/quotes",
        json={"delivery_days": 7, "items": [{"line_item_id": item_id, "unit_price": 10000.0}]},
        cookies=vendor_a["cookies"],
    )
    quote_a_id = res_qa.json()["data"]["id"]

    # Vendor B submits quote
    res_qb = await client.post(
        f"/api/rfqs/{rfq_id}/quotes",
        json={"delivery_days": 4, "items": [{"line_item_id": item_id, "unit_price": 11000.0}]},
        cookies=vendor_b["cookies"],
    )
    quote_b_id = res_qb.json()["data"]["id"]

    # Security check 1: Vendor A attempts to read Vendor B quote -> 403 Forbidden
    res_probe_a = await client.get(f"/api/quotes/{quote_b_id}", cookies=vendor_a["cookies"])
    assert res_probe_a.status_code == 403, "Vendor A must be blocked from Vendor B quote"

    # Security check 2: Vendor B attempts to read Vendor A quote -> 403 Forbidden
    res_probe_b = await client.get(f"/api/quotes/{quote_a_id}", cookies=vendor_b["cookies"])
    assert res_probe_b.status_code == 403, "Vendor B must be blocked from Vendor A quote"

    # Security check 3: Buyer can view both quotes
    res_buyer_a = await client.get(f"/api/quotes/{quote_a_id}", cookies=buyer["cookies"])
    assert res_buyer_a.status_code == 200
    res_buyer_b = await client.get(f"/api/quotes/{quote_b_id}", cookies=buyer["cookies"])
    assert res_buyer_b.status_code == 200


@pytest.mark.asyncio
async def test_buyer_isolation_security(client: AsyncClient, test_users: dict):
    """
    Test strict buyer isolation:
    - Buyer B cannot view Buyer A's RFQ (whether draft or published)
    - Buyer cannot browse the open vendor marketplace RFQ list (/api/rfqs)
    - Buyer /api/rfqs/my only returns their own RFQs
    """
    buyer_a = test_users["buyer"]
    buyer_b = test_users["buyer_b"]
    vendor_a = test_users["vendor_a"]

    # 1. Buyer A creates RFQ (draft)
    future_deadline = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    rfq_payload_a = {
        "title": "Buyer A Secret Equipment",
        "category": "Industrial",
        "delivery_location": "Hyderabad",
        "budget": 500000.0,
        "deadline": future_deadline,
        "line_items": [
            {"name": "Heavy Motor", "quantity": 2, "unit": "units"},
        ],
    }
    res_create_a = await client.post("/api/rfqs", json=rfq_payload_a, cookies=buyer_a["cookies"])
    assert res_create_a.status_code == 201
    rfq_a_id = res_create_a.json()["data"]["id"]

    # Security check 1: Buyer B tries to view Buyer A's draft RFQ -> 403 Forbidden
    res_b_view_draft = await client.get(f"/api/rfqs/{rfq_a_id}", cookies=buyer_b["cookies"])
    assert res_b_view_draft.status_code == 403, "Buyer B must not view Buyer A's draft RFQ"

    # 2. Buyer A publishes RFQ
    res_pub = await client.post(f"/api/rfqs/{rfq_a_id}/publish", cookies=buyer_a["cookies"])
    assert res_pub.status_code == 200

    # Security check 2: Buyer B tries to view Buyer A's published RFQ -> 403 Forbidden
    res_b_view_published = await client.get(f"/api/rfqs/{rfq_a_id}", cookies=buyer_b["cookies"])
    assert res_b_view_published.status_code == 403, "Buyer B must not view Buyer A's published RFQ"

    # Security check 3: Buyer A CAN view their own RFQ
    res_a_view = await client.get(f"/api/rfqs/{rfq_a_id}", cookies=buyer_a["cookies"])
    assert res_a_view.status_code == 200

    # Security check 4: Unified endpoint automatically scopes for Buyer A (cannot see Buyer B RFQ)
    res_buyer_a_rfqs = await client.get("/api/rfqs", cookies=buyer_a["cookies"])
    assert res_buyer_a_rfqs.status_code == 200
    buyer_a_rfq_ids = [item["id"] for item in res_buyer_a_rfqs.json()["data"]]
    assert rfq_a_id in buyer_a_rfq_ids

    # Security check 5: Vendor CAN view published RFQ and browse marketplace
    res_vendor_browse = await client.get("/api/rfqs", cookies=vendor_a["cookies"])
    assert res_vendor_browse.status_code == 200
    res_vendor_view = await client.get(f"/api/rfqs/{rfq_a_id}", cookies=vendor_a["cookies"])
    assert res_vendor_view.status_code == 200

    # 3. Buyer B creates their own RFQ
    rfq_payload_b = {
        "title": "Buyer B Logistics Needs",
        "category": "Logistics",
        "delivery_location": "Bangalore",
        "budget": 100000.0,
        "deadline": future_deadline,
        "line_items": [
            {"name": "Pallets", "quantity": 50, "unit": "units"},
        ],
    }
    res_create_b = await client.post("/api/rfqs", json=rfq_payload_b, cookies=buyer_b["cookies"])
    assert res_create_b.status_code == 201
    rfq_b_id = res_create_b.json()["data"]["id"]

    # Security check 6: Buyer A calling unified /api/rfqs NEVER sees Buyer B's RFQ
    res_buyer_a_unified = await client.get("/api/rfqs", cookies=buyer_a["cookies"])
    assert res_buyer_a_unified.status_code == 200
    ids_a_unified = [item["id"] for item in res_buyer_a_unified.json()["data"]]
    assert rfq_a_id in ids_a_unified
    assert rfq_b_id not in ids_a_unified, "Buyer A must never see Buyer B's RFQ in unified list"

    # Security check 7: Buyer B calling unified /api/rfqs NEVER sees Buyer A's RFQ
    res_buyer_b_unified = await client.get("/api/rfqs", cookies=buyer_b["cookies"])
    assert res_buyer_b_unified.status_code == 200
    ids_b_unified = [item["id"] for item in res_buyer_b_unified.json()["data"]]
    assert rfq_b_id in ids_b_unified
    assert rfq_a_id not in ids_b_unified, "Buyer B must never see Buyer A's RFQ in unified list"

    # Security check 8: Buyer /my alias endpoints also strictly isolated
    res_my_a = await client.get("/api/rfqs/my", cookies=buyer_a["cookies"])
    assert res_my_a.status_code == 200
    my_a_ids = [item["id"] for item in res_my_a.json()["data"]]
    assert rfq_a_id in my_a_ids
    assert rfq_b_id not in my_a_ids

    res_my_b = await client.get("/api/rfqs/my", cookies=buyer_b["cookies"])
    assert res_my_b.status_code == 200
    my_b_ids = [item["id"] for item in res_my_b.json()["data"]]
    assert rfq_b_id in my_b_ids
    assert rfq_a_id not in my_b_ids


@pytest.mark.asyncio
async def test_auto_close_expired_rfq_realtime(client: AsyncClient, test_users: dict):
    """
    Test real-time auto-close of RFQs:
    - Published RFQ whose deadline passes is auto-closed to 'closed' upon query
    - Expired RFQ disappears from vendor's open marketplace list
    - Expired RFQ appears when filtered by status=closed
    - Vendor quote submission is blocked because RFQ is closed
    """
    buyer = test_users["buyer"]
    vendor_a = test_users["vendor_a"]

    # 1. Buyer creates and publishes RFQ
    test_title = f"Realtime Auto Close Test {uuid.uuid4().hex[:8]}"
    future_deadline = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    create_res = await client.post(
        "/api/rfqs",
        json={
            "title": test_title,
            "category": "Machinery",
            "delivery_location": "Delhi",
            "deadline": future_deadline,
            "line_items": [{"name": "Pumps", "quantity": 4, "unit": "units"}],
        },
        cookies=buyer["cookies"],
    )
    assert create_res.status_code == 201
    rfq_id = create_res.json()["data"]["id"]
    line_item_id = create_res.json()["data"]["line_items"][0]["id"]
    await client.post(f"/api/rfqs/{rfq_id}/publish", cookies=buyer["cookies"])

    # Verify RFQ is published initially
    rfq_res1 = await client.get(f"/api/rfqs/{rfq_id}", cookies=buyer["cookies"])
    assert rfq_res1.json()["data"]["status"] == "published"

    # 2. Expire the deadline directly in DB (simulating time passing)
    async with SessionLocal() as db:
        rfq_obj = await db.get(RFQ, uuid.UUID(rfq_id))
        rfq_obj.deadline = datetime.now(timezone.utc) - timedelta(minutes=15)
        await db.commit()

    # 3. Query RFQ details -> Real-time guard triggers and auto-updates status to 'closed'
    rfq_res2 = await client.get(f"/api/rfqs/{rfq_id}", cookies=buyer["cookies"])
    assert rfq_res2.status_code == 200
    assert rfq_res2.json()["data"]["status"] == "closed"

    # 4. Verify in DB that status was persisted as 'closed'
    async with SessionLocal() as db:
        rfq_check = await db.get(RFQ, uuid.UUID(rfq_id))
        assert rfq_check.status == "closed"

    # 5. Vendor views open marketplace feed -> Expired RFQ is excluded from default open feed
    feed_res = await client.get("/api/rfqs", cookies=vendor_a["cookies"])
    assert feed_res.status_code == 200
    feed_ids = [item["id"] for item in feed_res.json()["data"]]
    assert rfq_id not in feed_ids

    # 6. Vendor queries with status=closed -> Expired RFQ is visible
    closed_feed_res = await client.get(f"/api/rfqs?status=closed&q={test_title}", cookies=vendor_a["cookies"])
    assert closed_feed_res.status_code == 200
    closed_ids = [item["id"] for item in closed_feed_res.json()["data"]]
    assert rfq_id in closed_ids

    # 7. Vendor attempts to quote against the closed RFQ -> 400 Bad Request
    quote_res = await client.post(
        f"/api/rfqs/{rfq_id}/quotes",
        json={"delivery_days": 5, "items": [{"line_item_id": line_item_id, "unit_price": 2000.0}]},
        cookies=vendor_a["cookies"],
    )
    assert quote_res.status_code == 400
    assert "deadline" in quote_res.json()["detail"].lower() or "closed" in quote_res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_rfq_line_item_crud_endpoints(client: AsyncClient, test_users: dict):
    """
    Test dedicated line item endpoints:
    - POST /api/rfqs/{id}/items: adds a line item
    - PUT /api/rfqs/{id}/items/{item_id}: edits a line item
    - DELETE /api/rfqs/{id}/items/{item_id}: deletes a line item
    - Enforces rules: cannot delete last line item, cannot modify items once RFQ is published
    """
    buyer = test_users["buyer"]
    buyer_b = test_users["buyer_b"]

    future_deadline = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    rfq_payload = {
        "title": "Line Item Management Test",
        "category": "Hardware",
        "delivery_location": "Hyderabad",
        "deadline": future_deadline,
        "line_items": [
            {"name": "Initial Item 1", "quantity": 10, "unit": "units"},
        ],
    }
    create_res = await client.post("/api/rfqs", json=rfq_payload, cookies=buyer["cookies"])
    assert create_res.status_code == 201
    rfq_id = create_res.json()["data"]["id"]
    item1_id = create_res.json()["data"]["line_items"][0]["id"]

    # 1. Add second line item via POST /api/rfqs/{id}/items
    add_payload = {"name": "Added Item 2", "quantity": 25, "unit": "boxes"}
    add_res = await client.post(f"/api/rfqs/{rfq_id}/items", json=add_payload, cookies=buyer["cookies"])
    assert add_res.status_code == 201
    item2 = add_res.json()["data"]
    assert item2["name"] == "Added Item 2"
    assert float(item2["quantity"]) == 25.0
    item2_id = item2["id"]

    # Verify RFQ now has 2 line items
    rfq_check = await client.get(f"/api/rfqs/{rfq_id}", cookies=buyer["cookies"])
    assert len(rfq_check.json()["data"]["line_items"]) == 2

    # 2. Update item 2 via PUT /api/rfqs/{id}/items/{item_id}
    update_payload = {"quantity": 30, "unit": "cartons"}
    put_res = await client.put(f"/api/rfqs/{rfq_id}/items/{item2_id}", json=update_payload, cookies=buyer["cookies"])
    assert put_res.status_code == 200
    updated_item = put_res.json()["data"]
    assert float(updated_item["quantity"]) == 30.0
    assert updated_item["unit"] == "cartons"

    # 3. Security: Buyer B cannot modify Buyer A's line items
    sec_res = await client.post(f"/api/rfqs/{rfq_id}/items", json=add_payload, cookies=buyer_b["cookies"])
    assert sec_res.status_code == 403

    # 4. Delete item 2 via DELETE /api/rfqs/{id}/items/{item_id}
    del_res = await client.delete(f"/api/rfqs/{rfq_id}/items/{item2_id}", cookies=buyer["cookies"])
    assert del_res.status_code == 200

    # 5. Attempt to delete item 1 (only remaining item) -> Fails with 400
    del_last_res = await client.delete(f"/api/rfqs/{rfq_id}/items/{item1_id}", cookies=buyer["cookies"])
    assert del_last_res.status_code == 400
    assert "at least one line item" in del_last_res.json()["detail"].lower()

    # 6. Publish RFQ
    pub_res = await client.post(f"/api/rfqs/{rfq_id}/publish", cookies=buyer["cookies"])
    assert pub_res.status_code == 200

    # 7. Attempt to add item after publication -> Fails with 400
    pub_add_res = await client.post(f"/api/rfqs/{rfq_id}/items", json=add_payload, cookies=buyer["cookies"])
    assert pub_add_res.status_code == 400
    assert "draft" in pub_add_res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_quote_shortlisting(client: AsyncClient, test_users: dict):
    """
    Test quote shortlisting flow:
    - Buyer shortlists a submitted quote via POST /api/quotes/{id}/shortlist
    - Quote status transitions from 'submitted' to 'shortlisted'
    - Shortlisted quote can be awarded
    - Non-owners cannot shortlist quotes
    """
    buyer = test_users["buyer"]
    vendor_a = test_users["vendor_a"]
    vendor_b = test_users["vendor_b"]

    future_deadline = (datetime.now(timezone.utc) + timedelta(days=4)).isoformat()
    rfq_payload = {
        "title": "Shortlisting Test RFQ",
        "category": "Electronics",
        "delivery_location": "Hyderabad",
        "deadline": future_deadline,
        "line_items": [{"name": "Laptops", "quantity": 5, "unit": "units"}],
    }
    rfq_res = await client.post("/api/rfqs", json=rfq_payload, cookies=buyer["cookies"])
    rfq_id = rfq_res.json()["data"]["id"]
    item_id = rfq_res.json()["data"]["line_items"][0]["id"]
    await client.post(f"/api/rfqs/{rfq_id}/publish", cookies=buyer["cookies"])

    # Vendor A submits quote
    qa_res = await client.post(
        f"/api/rfqs/{rfq_id}/quotes",
        json={"delivery_days": 7, "items": [{"line_item_id": item_id, "unit_price": 60000.0}]},
        cookies=vendor_a["cookies"],
    )
    quote_a_id = qa_res.json()["data"]["id"]

    # 1. Vendor cannot shortlist their own quote -> 403
    v_shortlist = await client.post(f"/api/quotes/{quote_a_id}/shortlist", cookies=vendor_a["cookies"])
    assert v_shortlist.status_code == 403

    # 2. Buyer shortlists Quote A
    b_shortlist = await client.post(
        f"/api/quotes/{quote_a_id}/shortlist",
        json={"notes": "Strong candidate based on lead time"},
        cookies=buyer["cookies"],
    )
    assert b_shortlist.status_code == 200
    assert b_shortlist.json()["data"]["status"] == "shortlisted"

    # 3. Verify quote detail displays 'shortlisted'
    q_check = await client.get(f"/api/quotes/{quote_a_id}", cookies=buyer["cookies"])
    assert q_check.json()["data"]["status"] == "shortlisted"

    # 4. Award the shortlisted quote
    award_res = await client.post(
        f"/api/rfqs/{rfq_id}/award",
        json={"quote_id": quote_a_id, "notes": "Awarded shortlisted quote"},
        cookies=buyer["cookies"],
    )
    assert award_res.status_code == 200
    assert award_res.json()["data"]["status"] == "awarded"

    # 5. Once awarded, attempting to shortlist again is rejected -> 400
    post_award_shortlist = await client.post(f"/api/quotes/{quote_a_id}/shortlist", cookies=buyer["cookies"])
    assert post_award_shortlist.status_code == 400


@pytest.mark.asyncio
async def test_status_history_tracking(client: AsyncClient, test_users: dict):
    """
    Test status history audit log:
    - RFQ lifecycle transitions are recorded and retrievable via GET /api/rfqs/{id}/history
    - Quote lifecycle transitions are recorded and retrievable via GET /api/quotes/{id}/history
    """
    buyer = test_users["buyer"]
    vendor_a = test_users["vendor_a"]
    vendor_b = test_users["vendor_b"]

    future_deadline = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    rfq_payload = {
        "title": "History Tracking RFQ",
        "category": "Services",
        "delivery_location": "Hyderabad",
        "deadline": future_deadline,
        "line_items": [{"name": "Consulting", "quantity": 100, "unit": "hours"}],
    }
    rfq_res = await client.post("/api/rfqs", json=rfq_payload, cookies=buyer["cookies"])
    rfq_id = rfq_res.json()["data"]["id"]
    item_id = rfq_res.json()["data"]["line_items"][0]["id"]

    # 1. RFQ created -> History should show draft
    rfq_hist_1 = await client.get(f"/api/rfqs/{rfq_id}/history", cookies=buyer["cookies"])
    assert rfq_hist_1.status_code == 200
    hist_entries_1 = rfq_hist_1.json()["data"]
    assert len(hist_entries_1) >= 1
    assert hist_entries_1[0]["to_status"] == "draft"

    # 2. Publish RFQ -> History records transition draft -> published
    await client.post(f"/api/rfqs/{rfq_id}/publish", cookies=buyer["cookies"])
    rfq_hist_2 = await client.get(f"/api/rfqs/{rfq_id}/history", cookies=buyer["cookies"])
    hist_entries_2 = rfq_hist_2.json()["data"]
    assert len(hist_entries_2) >= 2
    assert hist_entries_2[1]["from_status"] == "draft"
    assert hist_entries_2[1]["to_status"] == "published"

    # 3. Vendors submit quotes
    qa_res = await client.post(
        f"/api/rfqs/{rfq_id}/quotes",
        json={"delivery_days": 5, "items": [{"line_item_id": item_id, "unit_price": 500.0}]},
        cookies=vendor_a["cookies"],
    )
    quote_a_id = qa_res.json()["data"]["id"]

    qb_res = await client.post(
        f"/api/rfqs/{rfq_id}/quotes",
        json={"delivery_days": 8, "items": [{"line_item_id": item_id, "unit_price": 450.0}]},
        cookies=vendor_b["cookies"],
    )
    quote_b_id = qb_res.json()["data"]["id"]

    # Quote A submitted history
    qa_hist_1 = await client.get(f"/api/quotes/{quote_a_id}/history", cookies=vendor_a["cookies"])
    assert qa_hist_1.status_code == 200
    assert qa_hist_1.json()["data"][0]["to_status"] == "submitted"

    # 4. Shortlist Quote A
    await client.post(f"/api/quotes/{quote_a_id}/shortlist", cookies=buyer["cookies"])
    qa_hist_2 = await client.get(f"/api/quotes/{quote_a_id}/history", cookies=vendor_a["cookies"])
    qa_entries = qa_hist_2.json()["data"]
    assert len(qa_entries) >= 2
    assert qa_entries[1]["from_status"] == "submitted"
    assert qa_entries[1]["to_status"] == "shortlisted"

    # 5. Award RFQ to Quote A
    await client.post(
        f"/api/rfqs/{rfq_id}/award",
        json={"quote_id": quote_a_id, "notes": "Selected best proposal"},
        cookies=buyer["cookies"],
    )

    # 6. Verify RFQ history has 'awarded'
    rfq_hist_final = await client.get(f"/api/rfqs/{rfq_id}/history", cookies=buyer["cookies"])
    final_rfq_entries = rfq_hist_final.json()["data"]
    assert any(entry["to_status"] == "awarded" for entry in final_rfq_entries)

    # 7. Verify Quote A history has 'accepted'
    qa_hist_final = await client.get(f"/api/quotes/{quote_a_id}/history", cookies=vendor_a["cookies"])
    assert any(entry["to_status"] == "accepted" for entry in qa_hist_final.json()["data"])

    # 8. Verify Quote B history has 'rejected'
    qb_hist_final = await client.get(f"/api/quotes/{quote_b_id}/history", cookies=vendor_b["cookies"])
    assert any(entry["to_status"] == "rejected" for entry in qb_hist_final.json()["data"])



