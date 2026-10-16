import uuid
import pytest
from httpx import AsyncClient
from app.core.permissions import UserRoleEnum
from app.core.security import create_access_token


@pytest.mark.asyncio
async def test_admin_list_users_with_filters(client: AsyncClient, test_users):
    admin = test_users["admin"]
    buyer = test_users["buyer"]
    vendor_a = test_users["vendor_a"]

    # 1. Admin lists all users
    res = await client.get("/api/users", cookies=admin["cookies"])
    assert res.status_code == 200
    data = res.json()
    assert "data" in data
    assert "pagination" in data
    assert data["pagination"]["total_items"] >= 3
    user_ids = [u["id"] for u in data["data"]]
    assert str(buyer["id"]) in user_ids
    assert str(vendor_a["id"]) in user_ids

    # 2. Filter by role=vendor
    res_vendor = await client.get("/api/users?role=vendor", cookies=admin["cookies"])
    assert res_vendor.status_code == 200
    vendor_list = res_vendor.json()["data"]
    for u in vendor_list:
        assert u["role"] == "vendor"

    # 3. Search query q
    res_search = await client.get("/api/users?q=TestBuyer", cookies=admin["cookies"])
    assert res_search.status_code == 200
    search_list = res_search.json()["data"]
    assert len(search_list) >= 1
    assert any(u["id"] == str(buyer["id"]) for u in search_list)


@pytest.mark.asyncio
async def test_non_admin_cannot_access_admin_user_endpoints(client: AsyncClient, test_users):
    buyer = test_users["buyer"]
    vendor = test_users["vendor_a"]

    # Buyers cannot list users
    res = await client.get("/api/users", cookies=buyer["cookies"])
    assert res.status_code == 403

    # Vendors cannot list users
    res = await client.get("/api/users", cookies=vendor["cookies"])
    assert res.status_code == 403

    # Unauthenticated cannot list users
    res = await client.get("/api/users")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_admin_create_user_success_and_conflict(client: AsyncClient, test_users):
    admin = test_users["admin"]
    new_email = f"new_user_{uuid.uuid4().hex[:6]}@example.com"

    # 1. Admin creates a user
    create_payload = {
        "email": new_email,
        "password": "Password123!",
        "first_name": "Created",
        "last_name": "ByAdmin",
        "role": "vendor",
        "email_verified": True,
    }
    res = await client.post("/api/users", json=create_payload, cookies=admin["cookies"])
    assert res.status_code == 201
    user_data = res.json()["data"]
    assert user_data["email"] == new_email
    assert user_data["first_name"] == "Created"
    assert user_data["last_name"] == "ByAdmin"
    assert user_data["role"] == "vendor"
    assert user_data["email_verified"] is True
    assert user_data["is_deleted"] is False

    # 2. Conflict when creating again with same email
    res_duplicate = await client.post("/api/users", json=create_payload, cookies=admin["cookies"])
    assert res_duplicate.status_code == 400
    assert "already exists" in res_duplicate.json()["detail"]


@pytest.mark.asyncio
async def test_admin_get_user_by_id(client: AsyncClient, test_users):
    admin = test_users["admin"]
    buyer = test_users["buyer"]

    # 1. Fetch existing user
    res = await client.get(f"/api/users/{buyer['id']}", cookies=admin["cookies"])
    assert res.status_code == 200
    assert res.json()["data"]["id"] == str(buyer["id"])
    assert res.json()["data"]["role"] == "buyer"

    # 2. Fetch non-existent UUID -> 404
    non_existent = uuid.uuid4()
    res_404 = await client.get(f"/api/users/{non_existent}", cookies=admin["cookies"])
    assert res_404.status_code == 404


@pytest.mark.asyncio
async def test_admin_update_user_and_safeguards(client: AsyncClient, test_users):
    admin = test_users["admin"]
    buyer = test_users["buyer"]

    # 1. Admin updates buyer's name and role
    update_payload = {
        "first_name": "UpdatedBuyerName",
        "last_name": "NewSurname",
        "role": "vendor",
    }
    res = await client.patch(f"/api/users/{buyer['id']}", json=update_payload, cookies=admin["cookies"])
    assert res.status_code == 200
    updated_data = res.json()["data"]
    assert updated_data["first_name"] == "UpdatedBuyerName"
    assert updated_data["last_name"] == "NewSurname"
    assert updated_data["role"] == "vendor"

    # 2. Safeguard: Admin cannot demote themselves
    self_demote = {"role": "buyer"}
    res_demote = await client.patch(f"/api/users/{admin['id']}", json=self_demote, cookies=admin["cookies"])
    assert res_demote.status_code == 400
    assert "Cannot demote your own admin account" in res_demote.json()["detail"]

    # 3. Safeguard: Admin cannot deactivate their own account
    self_deactivate = {"is_deleted": True}
    res_deact = await client.patch(f"/api/users/{admin['id']}", json=self_deactivate, cookies=admin["cookies"])
    assert res_deact.status_code == 400
    assert "Cannot deactivate your own admin account" in res_deact.json()["detail"]


@pytest.mark.asyncio
async def test_admin_ban_unban_and_delete_user(client: AsyncClient, test_users):
    admin = test_users["admin"]

    # Create a dedicated target user for banning/deletion
    target_email = f"target_{uuid.uuid4().hex[:6]}@target.com"
    create_res = await client.post(
        "/api/users",
        json={
            "email": target_email,
            "password": "TargetPassword123!",
            "first_name": "Target",
            "last_name": "User",
            "role": "vendor",
        },
        cookies=admin["cookies"],
    )
    assert create_res.status_code == 201
    target_id = create_res.json()["data"]["id"]
    target_token = create_access_token({"sub": target_id, "role": "vendor"})
    target_cookies = {"access_token": f"Bearer {target_token}"}

    # Verify target can fetch profile initially
    prof_res = await client.get("/api/users/profile", cookies=target_cookies)
    assert prof_res.status_code == 200

    # 1. Admin bans the user
    ban_res = await client.post(f"/api/users/{target_id}/ban", cookies=admin["cookies"])
    assert ban_res.status_code == 200
    assert ban_res.json()["data"]["is_deleted"] is True

    # 2. Target user is immediately blocked from accessing protected endpoints
    blocked_res = await client.get("/api/users/profile", cookies=target_cookies)
    assert blocked_res.status_code == 403
    assert "deactivated or banned" in blocked_res.json()["detail"]

    # 3. Target user is blocked from signing in
    signin_res = await client.post(
        "/api/auth/signin",
        json={"email": target_email, "password": "TargetPassword123!"},
    )
    assert signin_res.status_code == 400
    assert "deactivated or banned" in signin_res.json()["detail"]

    # 4. Admin unbans the user
    unban_res = await client.post(f"/api/users/{target_id}/unban", cookies=admin["cookies"])
    assert unban_res.status_code == 200
    assert unban_res.json()["data"]["is_deleted"] is False

    # Target user can access profile again
    prof_res2 = await client.get("/api/users/profile", cookies=target_cookies)
    assert prof_res2.status_code == 200

    # 5. Admin soft-deletes the user
    del_res = await client.delete(f"/api/users/{target_id}", cookies=admin["cookies"])
    assert del_res.status_code == 200
    assert del_res.json()["data"]["is_deleted"] is True

    # 6. Safeguards: Admin cannot ban or delete themselves
    self_ban = await client.post(f"/api/users/{admin['id']}/ban", cookies=admin["cookies"])
    assert self_ban.status_code == 400
    assert "Cannot ban your own admin account" in self_ban.json()["detail"]

    self_del = await client.delete(f"/api/users/{admin['id']}", cookies=admin["cookies"])
    assert self_del.status_code == 400
    assert "Cannot delete your own admin account" in self_del.json()["detail"]
