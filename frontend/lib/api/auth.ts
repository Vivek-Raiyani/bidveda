import { apiClient } from "./client";
import {
  User,
  UserLoginInput,
  UserCreateInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from "@/types/auth";
import { MessageResponse } from "@/types/api";

export const authApi = {
  /**
   * Register a new user account (Buyer or Vendor).
   */
  signup: async (data: UserCreateInput): Promise<User> => {
    return apiClient.post<User>("/auth/signup", data);
  },

  /**
   * Authenticate user with email and password.
   * Sets HTTP-only cookies in browser.
   */
  signin: async (data: UserLoginInput): Promise<MessageResponse> => {
    return apiClient.post<MessageResponse>("/auth/signin", data);
  },

  /**
   * Retrieve the currently logged-in user profile.
   */
  getMe: async (): Promise<User> => {
    return apiClient.get<User>("/auth/me");
  },

  /**
   * Log out current user and clear HTTP-only cookies.
   */
  signout: async (): Promise<MessageResponse> => {
    return apiClient.post<MessageResponse>("/auth/signout");
  },

  /**
   * Manually rotate access and refresh tokens via refresh cookie.
   */
  refresh: async (): Promise<MessageResponse> => {
    return apiClient.post<MessageResponse>("/auth/refresh", undefined, {
      skipAuthRefresh: true,
    });
  },

  /**
   * Verify email address with token from verification email.
   */
  verifyEmail: async (token: string): Promise<MessageResponse> => {
    return apiClient.get<MessageResponse>("/auth/verify-email", {
      params: { token },
    });
  },

  /**
   * Request password reset email.
   */
  forgotPassword: async (data: ForgotPasswordInput): Promise<MessageResponse> => {
    return apiClient.post<MessageResponse>("/auth/forgot-password", data);
  },

  /**
   * Reset password with token received in email.
   */
  resetPassword: async (data: ResetPasswordInput): Promise<MessageResponse> => {
    return apiClient.post<MessageResponse>("/auth/reset-password", data);
  },
};
