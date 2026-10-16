import pytest
from fastapi import HTTPException

from app.core.permissions import (
    UserRoleEnum,
    Permission,
    ROLE_PERMISSIONS,
    get_role_permissions,
    has_permission,
    has_all_permissions,
    has_any_permission,
)
from app.models.user import User
from app.api.deps import require_permission, require_all_permissions, require_any_permission


class TestPermissions:
    """Unit tests for the RBAC permissions system."""

    def test_permission_enum_values_format(self):
        """All permissions should follow domain:action naming convention."""
        for perm in Permission:
            assert ":" in perm.value
            domain, action = perm.value.split(":", 1)
            assert len(domain) > 0
            assert len(action) > 0

    def test_admin_has_all_permissions(self):
        """Admin role must have every permission defined in the system."""
        admin_perms = get_role_permissions(UserRoleEnum.ADMIN)
        assert admin_perms == set(Permission)
        for perm in Permission:
            assert has_permission(UserRoleEnum.ADMIN, perm) is True
            assert has_permission("admin", perm.value) is True

    def test_buyer_permissions(self):
        """Verify explicit Buyer permissions and boundaries."""
        buyer_perms = get_role_permissions(UserRoleEnum.BUYER)

        # Buyer CAN do:
        expected_buyer = {
            Permission.RFQ_CREATE,
            Permission.RFQ_READ,
            Permission.RFQ_UPDATE,
            Permission.RFQ_DELETE,
            Permission.RFQ_PUBLISH,
            Permission.RFQ_CLOSE,
            Permission.RFQ_AWARD,
            Permission.QUOTE_READ,
            Permission.QUOTE_SHORTLIST,
            Permission.USER_READ,
            Permission.USER_UPDATE,
            Permission.ASSET_UPLOAD,
            Permission.ASSET_READ,
            Permission.ASSET_DELETE,
        }
        assert buyer_perms == expected_buyer

        # Buyer CANNOT do:
        disallowed_buyer = {
            Permission.QUOTE_CREATE,
            Permission.QUOTE_UPDATE,
            Permission.QUOTE_REVISE,
            Permission.QUOTE_DELETE,
            Permission.USER_DELETE,
            Permission.USER_BAN,
        }
        for perm in disallowed_buyer:
            assert has_permission(UserRoleEnum.BUYER, perm) is False
            assert perm not in buyer_perms

    def test_vendor_permissions(self):
        """Verify explicit Vendor permissions and boundaries."""
        vendor_perms = get_role_permissions(UserRoleEnum.VENDOR)

        # Vendor CAN do:
        expected_vendor = {
            Permission.RFQ_READ,
            Permission.QUOTE_CREATE,
            Permission.QUOTE_READ,
            Permission.QUOTE_UPDATE,
            Permission.QUOTE_REVISE,
            Permission.QUOTE_DELETE,
            Permission.USER_READ,
            Permission.USER_UPDATE,
            Permission.ASSET_UPLOAD,
            Permission.ASSET_READ,
            Permission.ASSET_DELETE,
        }
        assert vendor_perms == expected_vendor

        # Vendor CANNOT do:
        disallowed_vendor = {
            Permission.RFQ_CREATE,
            Permission.RFQ_UPDATE,
            Permission.RFQ_DELETE,
            Permission.RFQ_PUBLISH,
            Permission.RFQ_CLOSE,
            Permission.RFQ_AWARD,
            Permission.QUOTE_SHORTLIST,
            Permission.USER_DELETE,
            Permission.USER_BAN,
        }
        for perm in disallowed_vendor:
            assert has_permission(UserRoleEnum.VENDOR, perm) is False
            assert perm not in vendor_perms

    def test_has_permission_string_and_case_flexibility(self):
        """has_permission should support strings, Enums, and case-insensitivity."""
        # Case insensitive role strings
        assert has_permission("buyer", Permission.RFQ_CREATE) is True
        assert has_permission("BUYER", Permission.RFQ_CREATE) is True
        assert has_permission("Vendor", "quote:create") is True

        # String permission
        assert has_permission(UserRoleEnum.BUYER, "rfq:create") is True
        assert has_permission(UserRoleEnum.VENDOR, "quote:create") is True
        assert has_permission(UserRoleEnum.VENDOR, "rfq:create") is False

        # Invalid role or permission string returns False safely
        assert has_permission("non_existent_role", Permission.RFQ_CREATE) is False
        assert has_permission(UserRoleEnum.BUYER, "invalid:permission") is False
        assert has_permission("invalid_role", "invalid_permission") is False

    def test_get_role_permissions_invalid_role(self):
        """Unknown roles should return empty sets without error."""
        assert get_role_permissions("unknown") == set()
        assert get_role_permissions("superadmin") == set()

    def test_has_all_permissions(self):
        """has_all_permissions returns True only if every permission is held."""
        assert has_all_permissions(
            UserRoleEnum.BUYER,
            Permission.RFQ_CREATE,
            Permission.RFQ_READ,
            Permission.QUOTE_READ,
        ) is True

        # Vendor doesn't have RFQ_CREATE
        assert has_all_permissions(
            UserRoleEnum.VENDOR,
            Permission.RFQ_CREATE,
            Permission.QUOTE_CREATE,
        ) is False

    def test_has_any_permission(self):
        """has_any_permission returns True if at least one permission is held."""
        assert has_any_permission(
            UserRoleEnum.VENDOR,
            Permission.RFQ_CREATE,  # Not held
            Permission.QUOTE_CREATE,  # Held
        ) is True

        assert has_any_permission(
            UserRoleEnum.VENDOR,
            Permission.RFQ_CREATE,
            Permission.RFQ_AWARD,
        ) is False


@pytest.mark.asyncio
class TestPermissionDependencies:
    """Test require_permission dependency checkers in deps.py."""

    async def test_require_permission_granted(self):
        checker = require_permission(Permission.RFQ_CREATE)
        buyer_user = User(role="buyer")
        result = await checker(current_user=buyer_user)
        assert result == buyer_user

    async def test_require_permission_denied(self):
        checker = require_permission(Permission.RFQ_CREATE)
        vendor_user = User(role="vendor")
        with pytest.raises(HTTPException) as exc_info:
            await checker(current_user=vendor_user)
        assert exc_info.value.status_code == 403
        assert "Permission denied" in exc_info.value.detail

    async def test_require_permission_invalid_role(self):
        checker = require_permission(Permission.RFQ_CREATE)
        invalid_user = User(role="guest")
        with pytest.raises(HTTPException) as exc_info:
            await checker(current_user=invalid_user)
        assert exc_info.value.status_code == 403
        assert "Invalid user role" in exc_info.value.detail

    async def test_require_all_permissions_dependency(self):
        checker = require_all_permissions(Permission.RFQ_READ, Permission.QUOTE_CREATE)
        vendor_user = User(role="vendor")
        result = await checker(current_user=vendor_user)
        assert result == vendor_user

        buyer_user = User(role="buyer")
        with pytest.raises(HTTPException) as exc_info:
            await checker(current_user=buyer_user)
        assert exc_info.value.status_code == 403

    async def test_require_any_permission_dependency(self):
        checker = require_any_permission(Permission.RFQ_CREATE, Permission.QUOTE_CREATE)
        vendor_user = User(role="vendor")
        result = await checker(current_user=vendor_user)
        assert result == vendor_user

        buyer_user = User(role="buyer")
        result_buyer = await checker(current_user=buyer_user)
        assert result_buyer == buyer_user
