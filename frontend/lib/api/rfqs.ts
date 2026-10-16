import { apiClient } from "./client";
import {
  RFQ,
  RFQListItem,
  RFQCreate,
  RFQUpdate,
  RFQLineItem,
  RFQLineItemCreate,
  RFQLineItemUpdate,
  StatusHistoryItem,
  RFQFilterParams,
} from "@/types/rfq";
import {
  RFQComparisonView,
  AwardQuoteRequest,
  AwardQuoteResponse,
} from "@/types/quote";
import { DataResponse, MessageResponse } from "@/types/api";

export const rfqApi = {
  /**
   * Unified list endpoint for RFQs with role-based scoping and filtering.
   */
  list: async (
    params?: RFQFilterParams
  ): Promise<DataResponse<RFQListItem[]>> => {
    return apiClient.get<DataResponse<RFQListItem[]>>("/rfqs", {
      params: params as Record<string, string | number | boolean | undefined>,
    });
  },

  /**
   * Convenience alias to list the buyer's own RFQs with filters.
   */
  listMy: async (
    params?: RFQFilterParams
  ): Promise<DataResponse<RFQListItem[]>> => {
    return apiClient.get<DataResponse<RFQListItem[]>>("/rfqs/my", {
      params: params as Record<string, string | number | boolean | undefined>,
    });
  },

  /**
   * Get detailed RFQ information with line items.
   */
  getById: async (id: string): Promise<DataResponse<RFQ>> => {
    return apiClient.get<DataResponse<RFQ>>(`/rfqs/${id}`);
  },

  /**
   * Create a new RFQ in DRAFT status.
   */
  create: async (data: RFQCreate): Promise<DataResponse<RFQ>> => {
    return apiClient.post<DataResponse<RFQ>>("/rfqs", data);
  },

  /**
   * Update an existing RFQ in DRAFT status.
   */
  update: async (id: string, data: RFQUpdate): Promise<DataResponse<RFQ>> => {
    return apiClient.put<DataResponse<RFQ>>(`/rfqs/${id}`, data);
  },

  /**
   * Publish a draft RFQ to marketplace.
   */
  publish: async (id: string): Promise<DataResponse<RFQ>> => {
    return apiClient.post<DataResponse<RFQ>>(`/rfqs/${id}/publish`);
  },

  /**
   * Add a line item to a draft RFQ.
   */
  addLineItem: async (
    rfqId: string,
    data: RFQLineItemCreate
  ): Promise<DataResponse<RFQLineItem>> => {
    return apiClient.post<DataResponse<RFQLineItem>>(
      `/rfqs/${rfqId}/items`,
      data
    );
  },

  /**
   * Update a line item in a draft RFQ.
   */
  updateLineItem: async (
    rfqId: string,
    itemId: string,
    data: RFQLineItemUpdate
  ): Promise<DataResponse<RFQLineItem>> => {
    return apiClient.put<DataResponse<RFQLineItem>>(
      `/rfqs/${rfqId}/items/${itemId}`,
      data
    );
  },

  /**
   * Delete a line item from a draft RFQ.
   */
  deleteLineItem: async (
    rfqId: string,
    itemId: string
  ): Promise<MessageResponse> => {
    return apiClient.delete<MessageResponse>(`/rfqs/${rfqId}/items/${itemId}`);
  },

  /**
   * Fetch side-by-side quote comparison matrix.
   */
  getComparison: async (
    rfqId: string,
    sortBy: "total_amount" | "delivery_days" | "created_at" = "total_amount",
    sortOrder: "asc" | "desc" = "asc"
  ): Promise<DataResponse<RFQComparisonView>> => {
    return apiClient.get<DataResponse<RFQComparisonView>>(
      `/rfqs/${rfqId}/compare`,
      {
        params: { sort_by: sortBy, sort_order: sortOrder },
      }
    );
  },

  /**
   * Award RFQ to a winning quote.
   */
  award: async (
    rfqId: string,
    data: AwardQuoteRequest
  ): Promise<DataResponse<AwardQuoteResponse>> => {
    return apiClient.post<DataResponse<AwardQuoteResponse>>(
      `/rfqs/${rfqId}/award`,
      data
    );
  },

  /**
   * Get complete status change audit trail for an RFQ.
   */
  getHistory: async (
    rfqId: string
  ): Promise<DataResponse<StatusHistoryItem[]>> => {
    return apiClient.get<DataResponse<StatusHistoryItem[]>>(
      `/rfqs/${rfqId}/history`
    );
  },
};
