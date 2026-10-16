import {
  UserRole,
  PermissionType,
  ROLE_PERMISSIONS,
} from "@/types/permissions";
import { User } from "@/types/auth";

/**
 * Retrieve permissions granted to a given role.
 */
export function getRolePermissions(
  role?: UserRole | null
): ReadonlySet<PermissionType> {
  if (!role) return new Set();
  return ROLE_PERMISSIONS[role] || new Set();
}

/**
 * Check if the user has a specific permission.
 */
export function hasPermission(
  user: User | null | undefined,
  permission: PermissionType
): boolean {
  if (!user || !user.role) return false;
  const permissions = getRolePermissions(user.role);
  return permissions.has(permission);
}

/**
 * Check if the user has one of the allowed roles.
 */
export function hasRole(
  user: User | null | undefined,
  ...allowedRoles: UserRole[]
): boolean {
  if (!user || !user.role) return false;
  return allowedRoles.includes(user.role);
}

/**
 * Check if user is a buyer.
 */
export function isBuyer(user: User | null | undefined): boolean {
  return user?.role === UserRole.BUYER;
}

/**
 * Check if user is a vendor.
 */
export function isVendor(user: User | null | undefined): boolean {
  return user?.role === UserRole.VENDOR;
}

/**
 * Check if user is an admin.
 */
export function isAdmin(user: User | null | undefined): boolean {
  return user?.role === UserRole.ADMIN;
}
