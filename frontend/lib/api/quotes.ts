import { apiClient } from "./client";
import {
  Quote,
  QuoteCreate,
  QuoteRevise,
  QuoteFilterParams,
  ShortlistQuoteRequest,
} from "@/types/quote";
import { StatusHistoryItem } from "@/types/rfq";
import { DataResponse } from "@/types/api";

export const quoteApi = {
  /**
   * Submit an initial quote against an open RFQ.
   */
  submit: async (
    rfqId: string,
    data: QuoteCreate
  ): Promise<DataResponse<Quote>> => {
    return apiClient.post<DataResponse<Quote>>(`/rfqs/${rfqId}/quotes`, data);
  },

  /**
   * Revise an existing quote before RFQ deadline.
   */
  revise: async (
    quoteId: string,
    data: QuoteRevise
  ): Promise<DataResponse<Quote>> => {
    return apiClient.put<DataResponse<Quote>>(`/quotes/${quoteId}`, data);
  },

  /**
   * Shortlist a quote for an RFQ (buyers / admins only).
   */
  shortlist: async (
    quoteId: string,
    data?: ShortlistQuoteRequest
  ): Promise<DataResponse<Quote>> => {
    return apiClient.post<DataResponse<Quote>>(
      `/quotes/${quoteId}/shortlist`,
      data
    );
  },

  /**
   * List quotes submitted by authenticated vendor.
   */
  listMy: async (
    params?: QuoteFilterParams
  ): Promise<DataResponse<Quote[]>> => {
    return apiClient.get<DataResponse<Quote[]>>("/quotes/my", {
      params: params as Record<string, string | number | boolean | undefined>,
    });
  },

  /**
   * Get quote details by ID.
   */
  getById: async (quoteId: string): Promise<DataResponse<Quote>> => {
    return apiClient.get<DataResponse<Quote>>(`/quotes/${quoteId}`);
  },

  /**
   * Get quote status history audit trail.
   */
  getHistory: async (
    quoteId: string
  ): Promise<DataResponse<StatusHistoryItem[]>> => {
    return apiClient.get<DataResponse<StatusHistoryItem[]>>(
      `/quotes/${quoteId}/history`
    );
  },
};
