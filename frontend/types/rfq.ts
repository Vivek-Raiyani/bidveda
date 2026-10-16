export type RFQStatus =
  | "draft"
  | "published"
  | "closed"
  | "awarded"
  | "cancelled";

export const RFQStatus = {
  DRAFT: "draft" as const,
  PUBLISHED: "published" as const,
  CLOSED: "closed" as const,
  AWARDED: "awarded" as const,
  CANCELLED: "cancelled" as const,
};

export interface RFQLineItemBase {
  name: string;
  quantity: number;
  unit: string;
}

export type RFQLineItemCreate = RFQLineItemBase;

export interface RFQLineItemUpdate {
  id?: string;
  name?: string;
  quantity?: number;
  unit?: string;
}

export interface RFQLineItem extends RFQLineItemBase {
  id: string;
  rfq_id: string;
  created_at: string;
}

export interface RFQBase {
  title: string;
  description?: string | null;
  category: string;
  delivery_location: string;
  budget?: number | null;
  deadline: string; // ISO string
}

export interface RFQCreate extends RFQBase {
  line_items: RFQLineItemCreate[];
}

export interface RFQUpdate {
  title?: string;
  description?: string | null;
  category?: string;
  delivery_location?: string;
  budget?: number | null;
  deadline?: string;
  line_items?: RFQLineItemCreate[];
}

export interface RFQListItem {
  id: string;
  buyer_id: string;
  title: string;
  category: string;
  delivery_location: string;
  budget?: number | null;
  deadline: string;
  status: RFQStatus;
  items_count: number;
  quotes_count?: number | null;
  created_at: string;
  updated_at: string;
}

export interface RFQ extends RFQBase {
  id: string;
  buyer_id: string;
  buyer_name?: string | null;
  status: RFQStatus;
  created_at: string;
  updated_at: string;
  line_items: RFQLineItem[];
  quotes_count?: number | null;
}

export interface StatusHistoryItem {
  id: string;
  entity_type: string;
  entity_id: string;
  from_status?: string | null;
  to_status: string;
  changed_by_id?: string | null;
  changed_by_name?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface RFQFilterParams {
  q?: string;
  category?: string;
  delivery_location?: string;
  status?: RFQStatus;
  deadline_after?: string;
  deadline_before?: string;
  page?: number;
  limit?: number;
}
