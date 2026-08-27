'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  PLATFORM_ACCESS_KEY,
  PLATFORM_REFRESH_KEY,
  clearPlatformAuthStorage,
  ensureValidPlatformAccessToken,
  hasStoredPlatformAuthSession,
  refreshPlatformAccessTokenWithLock,
} from './platform-api';
import { PlatformUser, platformAuthApi } from './platform-auth';

interface PlatformAuthContextType {
  user: PlatformUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const PlatformAuthContext = createContext<PlatformAuthContextType | undefined>(undefined);

export function PlatformAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PlatformUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const checkAuth = useCallback(async () => {
    if (!hasStoredPlatformAuthSession()) {
      setIsLoading(false);
      return;
    }

    try {
      try {
        const sessionOk = await ensureValidPlatformAccessToken();
        if (!sessionOk) {
          clearPlatformAuthStorage();
          return;
        }
      } catch {
        return;
      }

      try {
        const profile = await platformAuthApi.getProfile();
        setUser(profile);
      } catch (error: unknown) {
        const statusCode =
          typeof error === 'object' && error !== null && 'statusCode' in error
            ? (error as { statusCode?: number }).statusCode
            : undefined;
        if (
          (statusCode === 401 || statusCode === 403) &&
          localStorage.getItem(PLATFORM_REFRESH_KEY)
        ) {
          try {
            await refreshPlatformAccessTokenWithLock();
            const profile = await platformAuthApi.getProfile();
            setUser(profile);
            return;
          } catch (retryError: unknown) {
            const retryStatus =
              typeof retryError === 'object' && retryError !== null && 'statusCode' in retryError
                ? (retryError as { statusCode?: number }).statusCode
                : undefined;
            if (retryStatus === 401 || retryStatus === 403) {
              clearPlatformAuthStorage();
            }
            return;
          }
        }
        if (statusCode === 401 || statusCode === 403) {
          clearPlatformAuthStorage();
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
      if (event.key === PLATFORM_ACCESS_KEY) {
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
    const response = await platformAuthApi.login({
      username: username.trim(),
      password: password.trim(),
    });
    localStorage.setItem(PLATFORM_ACCESS_KEY, response.access);
    localStorage.setItem(PLATFORM_REFRESH_KEY, response.refresh);
    setUser(response.user);
  };

  const logout = () => {
    platformAuthApi.logout();
    setUser(null);
    router.push('/console');
  };

  return (
    <PlatformAuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </PlatformAuthContext.Provider>
  );
}

export function usePlatformAuth() {
  const context = useContext(PlatformAuthContext);
  if (context === undefined) {
    throw new Error('usePlatformAuth must be used within a PlatformAuthProvider');
  }
  return context;
}
