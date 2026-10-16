import { UserRole } from "./permissions";

export type SignupRole = "buyer" | "vendor";

export interface User {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  role: UserRole;
  email_verified?: boolean;
  is_deleted?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AdminUserCreateInput {
  email: string;
  password: string;
  first_name: string;
  last_name?: string | null;
  role: UserRole;
  email_verified?: boolean;
}

export interface AdminUserUpdateInput {
  first_name?: string | null;
  last_name?: string | null;
  email?: string;
  role?: UserRole;
  email_verified?: boolean;
  is_deleted?: boolean;
}

export interface UserFilterParams {
  q?: string;
  role?: UserRole;
  email_verified?: boolean;
  is_deleted?: boolean;
  page?: number;
  limit?: number;
}

export interface UserLoginInput {
  email: string;
  password: string;
}

export interface UserCreateInput {
  email: string;
  first_name: string;
  last_name?: string | null;
  password: string;
  role: SignupRole;
}

export interface UserUpdateInput {
  email?: string;
  first_name?: string | null;
  last_name?: string | null;
}

export interface UserUpdatePasswordInput {
  current_password: string;
  new_password: string;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  token: string;
  new_password: string;
}

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: UserLoginInput) => Promise<User>;
  signup: (data: UserCreateInput) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
}
