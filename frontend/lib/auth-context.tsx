'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { User } from './auth';
import { authApi } from './auth';
import {
  clearAuthStorage,
  ensureValidAccessToken,
  hasStoredAuthSession,
  TENANT_SCHEMA_KEY,
} from './api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (data: {
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    password: string;
    confirm_password: string;
  }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const checkAuth = useCallback(async () => {
    if (!hasStoredAuthSession()) {
      setIsLoading(false);
      return;
    }

    try {
      try {
        const sessionOk = await ensureValidAccessToken();
        if (!sessionOk) {
          clearAuthStorage();
          return;
        }
      } catch {
        // Network failure during refresh — keep stored tokens for a later retry.
        return;
      }

      try {
        const userData = await authApi.getProfile();
        setUser(userData);
      } catch (error: unknown) {
        const statusCode =
          typeof error === 'object' &&
          error !== null &&
          'statusCode' in error &&
          typeof (error as { statusCode?: number }).statusCode === 'number'
            ? (error as { statusCode: number }).statusCode
            : undefined;
        // Keep tokens on temporary/network/server issues; only clear on explicit auth failures.
        if (statusCode === 401 || statusCode === 403) {
          clearAuthStorage();
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'access_token') {
        if (event.newValue) {
          void checkAuth();
        } else {
          setUser(null);
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [checkAuth]);

  const login = async (username: string, password: string) => {
    try {
      const response = await authApi.login({
        username: username.trim(),
        password: password.trim(),
      });
      localStorage.setItem('access_token', response.access);
      localStorage.setItem('refresh_token', response.refresh);
      localStorage.setItem(TENANT_SCHEMA_KEY, response.tenant.schema_name);
      setUser(response.user);
    } catch (error: any) {
      console.error('Login error:', error);
      console.error('Error response:', error.response);
      console.error('Error data:', error.response?.data);
      console.error('Error status:', error.response?.status);
      throw error;
    }
  };

  const register = async (data: {
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    password: string;
    confirm_password: string;
  }) => {
    try {
      const response = await authApi.register(data);
      localStorage.setItem('access_token', response.access);
      localStorage.setItem('refresh_token', response.refresh);
      setUser(response.user);
    } catch (error: any) {
      console.error('Registration error:', error);
      console.error('Error response:', error.response);
      console.error('Error data:', error.response?.data);
      console.error('Error status:', error.response?.status);
      throw error;
    }
  };

  const logout = () => {
    authApi.logout();
    setUser(null);
    router.push('/');
  };

  const refreshUser = async () => {
    if (!user) return;
    const userData = await authApi.getProfile();
    setUser(userData);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
