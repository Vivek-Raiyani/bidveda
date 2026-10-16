import { apiClient } from "./client";
import {
  User,
  AdminUserCreateInput,
  AdminUserUpdateInput,
  UserFilterParams,
} from "@/types/auth";
import { DataResponse } from "@/types/api";

export const usersApi = {
  /**
   * List all users with filtering and pagination (Admin only)
   */
  list: async (
    params?: UserFilterParams
  ): Promise<DataResponse<User[]>> => {
    return apiClient.get<DataResponse<User[]>>("/users", {
      params: params as Record<string, string | number | boolean | undefined>,
    });
  },

  /**
   * Get user by ID (Admin only)
   */
  getById: async (userId: string): Promise<DataResponse<User>> => {
    return apiClient.get<DataResponse<User>>(`/users/${userId}`);
  },

  /**
   * Create a new user as an administrator (Admin only)
   */
  create: async (data: AdminUserCreateInput): Promise<DataResponse<User>> => {
    return apiClient.post<DataResponse<User>>("/users", data);
  },

  /**
   * Update a user's role, name, email, or status (Admin only)
   */
  update: async (
    userId: string,
    data: AdminUserUpdateInput
  ): Promise<DataResponse<User>> => {
    return apiClient.patch<DataResponse<User>>(`/users/${userId}`, data);
  },

  /**
   * Soft-delete a user account (Admin only)
   */
  delete: async (userId: string): Promise<DataResponse<User>> => {
    return apiClient.delete<DataResponse<User>>(`/users/${userId}`);
  },

  /**
   * Ban a user (Admin only)
   */
  ban: async (userId: string): Promise<DataResponse<User>> => {
    return apiClient.post<DataResponse<User>>(`/users/${userId}/ban`);
  },

  /**
   * Unban a user (Admin only)
   */
  unban: async (userId: string): Promise<DataResponse<User>> => {
    return apiClient.post<DataResponse<User>>(`/users/${userId}/unban`);
  },
};
