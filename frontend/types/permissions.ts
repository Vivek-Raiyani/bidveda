export type UserRole = "buyer" | "vendor" | "admin";

export const UserRole = {
  BUYER: "buyer" as const,
  VENDOR: "vendor" as const,
  ADMIN: "admin" as const,
};

export const Permission = {
  // RFQ permissions
  RFQ_CREATE: "rfq:create",
  RFQ_READ: "rfq:read",
  RFQ_UPDATE: "rfq:update",
  RFQ_DELETE: "rfq:delete",
  RFQ_PUBLISH: "rfq:publish",
  RFQ_CLOSE: "rfq:close",
  RFQ_AWARD: "rfq:award",

  // Quote permissions
  QUOTE_CREATE: "quote:create",
  QUOTE_READ: "quote:read",
  QUOTE_UPDATE: "quote:update",
  QUOTE_REVISE: "quote:revise",
  QUOTE_DELETE: "quote:delete",
  QUOTE_SHORTLIST: "quote:shortlist",

  // Auction permissions (legacy)
  AUCTION_CREATE: "auction:create",
  AUCTION_READ: "auction:read",
  AUCTION_UPDATE: "auction:update",
  AUCTION_DELETE: "auction:delete",

  // Bidding permissions (legacy)
  BID_PLACE: "bid:place",
  BID_READ: "bid:read",
  BID_CANCEL: "bid:cancel",

  // User & admin permissions
  USER_READ: "user:read",
  USER_UPDATE: "user:update",
  USER_DELETE: "user:delete",
  USER_BAN: "user:ban",

  // Asset permissions
  ASSET_UPLOAD: "asset:upload",
  ASSET_READ: "asset:read",
  ASSET_DELETE: "asset:delete",
} as const;

export type PermissionType = (typeof Permission)[keyof typeof Permission];

export const VENDOR_PERMISSIONS: ReadonlySet<PermissionType> = new Set([
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
  Permission.AUCTION_READ,
  Permission.BID_PLACE,
  Permission.BID_READ,
  Permission.AUCTION_CREATE,
  Permission.AUCTION_UPDATE,
  Permission.AUCTION_DELETE,
]);

export const BUYER_PERMISSIONS: ReadonlySet<PermissionType> = new Set([
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
  Permission.AUCTION_READ,
  Permission.BID_PLACE,
  Permission.BID_READ,
]);

export const ALL_PERMISSIONS: ReadonlySet<PermissionType> = new Set(
  Object.values(Permission)
);

export const ROLE_PERMISSIONS: Record<UserRole, ReadonlySet<PermissionType>> = {
  buyer: BUYER_PERMISSIONS,
  vendor: VENDOR_PERMISSIONS,
  admin: ALL_PERMISSIONS,
};

