import { RFQStatus, RFQLineItem } from "./rfq";

export type QuoteStatus =
  | "submitted"
  | "revised"
  | "shortlisted"
  | "accepted"
  | "rejected"
  | "withdrawn";

export const QuoteStatus = {
  SUBMITTED: "submitted" as const,
  REVISED: "revised" as const,
  SHORTLISTED: "shortlisted" as const,
  ACCEPTED: "accepted" as const,
  REJECTED: "rejected" as const,
  WITHDRAWN: "withdrawn" as const,
};

export interface QuoteItemCreate {
  line_item_id: string;
  unit_price: number;
}

export interface QuoteItem {
  id: string;
  quote_id: string;
  line_item_id: string;
  line_item_name?: string | null;
  quantity?: number | null;
  unit?: string | null;
  unit_price: number;
  total_price: number;
  created_at: string;
}

export interface QuoteCreate {
  delivery_days: number;
  notes?: string | null;
  items: QuoteItemCreate[];
}

export interface QuoteRevise {
  delivery_days?: number;
  notes?: string | null;
  items: QuoteItemCreate[];
}

export interface QuoteStatusUpdate {
  status: QuoteStatus;
  notes?: string | null;
}

export interface ShortlistQuoteRequest {
  notes?: string | null;
}

export interface Quote {
  id: string;
  rfq_id: string;
  vendor_id: string;
  vendor_name?: string | null;
  version: number;
  delivery_days: number;
  notes?: string | null;
  total_amount: number;
  status: QuoteStatus;
  created_at: string;
  updated_at: string;
  items: QuoteItem[];
}

export interface ComparisonItemPrice {
  line_item_id: string;
  line_item_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
}

export interface ComparisonQuoteColumn {
  quote_id: string;
  vendor_id: string;
  vendor_name: string;
  version: number;
  delivery_days: number;
  notes?: string | null;
  total_amount: number;
  status: QuoteStatus;
  created_at: string;
  item_prices: ComparisonItemPrice[];
}

export interface RFQComparisonView {
  rfq_id: string;
  rfq_title: string;
  rfq_status: RFQStatus;
  deadline: string;
  line_items: RFQLineItem[];
  quotes: ComparisonQuoteColumn[];
}

export interface AwardQuoteRequest {
  quote_id: string;
  notes?: string | null;
}

export interface AwardQuoteResponse {
  rfq_id: string;
  awarded_quote_id: string;
  awarded_vendor_id: string;
  awarded_vendor_name?: string | null;
  total_amount: number;
  delivery_days: number;
  status: RFQStatus;
  message: string;
}

export interface QuoteFilterParams {
  status?: QuoteStatus;
  page?: number;
  limit?: number;
}
