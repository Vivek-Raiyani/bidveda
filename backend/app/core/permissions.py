from enum import Enum
from typing import Union


class UserRoleEnum(str, Enum):
    BUYER = "buyer"
    VENDOR = "vendor"
    ADMIN = "admin"


class Permission(str, Enum):
    # RFQ permissions
    RFQ_CREATE = "rfq:create"
    RFQ_READ = "rfq:read"
    RFQ_UPDATE = "rfq:update"
    RFQ_DELETE = "rfq:delete"
    RFQ_PUBLISH = "rfq:publish"
    RFQ_CLOSE = "rfq:close"
    RFQ_AWARD = "rfq:award"

    # Quote permissions
    QUOTE_CREATE = "quote:create"
    QUOTE_READ = "quote:read"
    QUOTE_UPDATE = "quote:update"
    QUOTE_REVISE = "quote:revise"
    QUOTE_DELETE = "quote:delete"
    QUOTE_SHORTLIST = "quote:shortlist"

    # User & admin permissions
    USER_READ = "user:read"
    USER_UPDATE = "user:update"
    USER_DELETE = "user:delete"
    USER_BAN = "user:ban"

    # Asset permissions
    ASSET_UPLOAD = "asset:upload"
    ASSET_READ = "asset:read"
    ASSET_DELETE = "asset:delete"


# Vendor permissions set
_VENDOR_PERMISSIONS: set[Permission] = {
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

# Buyer permissions set
_BUYER_PERMISSIONS: set[Permission] = {
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

# Define role-to-permission mappings
ROLE_PERMISSIONS: dict[UserRoleEnum, set[Permission]] = {
    UserRoleEnum.BUYER: _BUYER_PERMISSIONS,
    UserRoleEnum.VENDOR: _VENDOR_PERMISSIONS,
    UserRoleEnum.ADMIN: set(Permission),  # Admins have all permissions
}


def get_role_permissions(role: Union[UserRoleEnum, str]) -> set[Permission]:
    """Retrieve all permissions granted to a given role.
    
    Accepts either a UserRoleEnum instance or a case-insensitive string (e.g. 'buyer', 'BUYER').
    Returns an empty set if the role is unrecognized.
    """
    if isinstance(role, str):
        try:
            role = UserRoleEnum(role.lower())
        except ValueError:
            return set()
    return ROLE_PERMISSIONS.get(role, set())


def has_permission(role: Union[UserRoleEnum, str], permission: Union[Permission, str]) -> bool:
    """Check if a role has a specific permission.
    
    Accepts UserRoleEnum or string for role, and Permission or string for permission.
    Returns False if either the role or permission is invalid, or if permission is not granted.
    """
    if isinstance(permission, str):
        try:
            permission = Permission(permission)
        except ValueError:
            return False
    return permission in get_role_permissions(role)


def has_all_permissions(role: Union[UserRoleEnum, str], *permissions: Union[Permission, str]) -> bool:
    """Check if a role has ALL of the specified permissions."""
    return all(has_permission(role, p) for p in permissions)


def has_any_permission(role: Union[UserRoleEnum, str], *permissions: Union[Permission, str]) -> bool:
    """Check if a role has AT LEAST ONE of the specified permissions."""
    return any(has_permission(role, p) for p in permissions)

