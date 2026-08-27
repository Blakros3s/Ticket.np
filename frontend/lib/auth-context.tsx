'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { User } from './auth';
import { authApi } from './auth';
import {
  clearAuthStorage,
  hasStoredAuthSession,
  refreshAccessTokenWithLock,
  restoreAuthSession,
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

function getErrorStatusCode(error: unknown): number | undefined {
  if (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    typeof (error as { statusCode?: number }).statusCode === 'number'
  ) {
    return (error as { statusCode: number }).statusCode;
  }
  return undefined;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const loadProfile = useCallback(async (): Promise<void> => {
    const userData = await authApi.getProfile();
    setUser(userData);
  }, []);

  const checkAuth = useCallback(async () => {
    if (!hasStoredAuthSession()) {
      setIsLoading(false);
      return;
    }

    try {
      const sessionOk = await restoreAuthSession();
      if (!sessionOk) {
        clearAuthStorage();
        return;
      }

      try {
        await loadProfile();
      } catch (error: unknown) {
        const statusCode = getErrorStatusCode(error);
        if (
          (statusCode === 401 || statusCode === 403) &&
          localStorage.getItem('refresh_token')
        ) {
          try {
            await refreshAccessTokenWithLock();
            await loadProfile();
            return;
          } catch (retryError: unknown) {
            const retryStatus = getErrorStatusCode(retryError);
            if (retryStatus === 401 || retryStatus === 403) {
              clearAuthStorage();
            }
            return;
          }
        }
        if (statusCode === 401 || statusCode === 403) {
          clearAuthStorage();
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [loadProfile]);

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
    } catch (error: unknown) {
      console.error('Login error:', error);
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
    } catch (error: unknown) {
      console.error('Registration error:', error);
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
    await loadProfile();
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
