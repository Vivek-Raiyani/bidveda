"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import {
  User,
  UserLoginInput,
  UserCreateInput,
  AuthContextType,
} from "@/types/auth";
import { authApi } from "@/lib/api/auth";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCurrentUser = useCallback(async (): Promise<User | null> => {
    try {
      const currentUser = await authApi.getMe();
      setUser(currentUser);
      return currentUser;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      setIsLoading(true);
      try {
        await fetchCurrentUser();
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    initAuth();

    return () => {
      mounted = false;
    };
  }, [fetchCurrentUser]);

  const login = async (credentials: UserLoginInput): Promise<User> => {
    setIsLoading(true);
    try {
      await authApi.signin(credentials);
      const currentUser = await authApi.getMe();
      setUser(currentUser);
      return currentUser;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (data: UserCreateInput): Promise<User> => {
    setIsLoading(true);
    try {
      const newUser = await authApi.signup(data);
      // Automatically attempt sign in after signup
      try {
        await authApi.signin({
          email: data.email,
          password: data.password,
        });
        const currentUser = await authApi.getMe();
        setUser(currentUser);
        return currentUser;
      } catch {
        return newUser;
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await authApi.signout();
    } catch {
      // Ignore network errors on logout to allow local cleanup
    } finally {
      setUser(null);
      setIsLoading(false);
    }
  };

  const refreshUser = async (): Promise<User | null> => {
    return fetchCurrentUser();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        signup,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
