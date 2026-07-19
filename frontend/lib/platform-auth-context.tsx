'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PLATFORM_ACCESS_KEY, PLATFORM_REFRESH_KEY } from './platform-api';
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

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem(PLATFORM_ACCESS_KEY);
      if (!token) {
        setIsLoading(false);
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
        if (statusCode === 401 || statusCode === 403) {
          platformAuthApi.logout();
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

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
    router.push('/server/login');
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
