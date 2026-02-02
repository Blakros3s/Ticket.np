'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User } from './auth';
import { authApi } from './auth';

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

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('access_token');
    if (token) {
      try {
        const userData = await authApi.getProfile();
        setUser(userData);
      } catch (error) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      }
    }
    setIsLoading(false);
  };

  const login = async (username: string, password: string) => {
    try {
      const response = await authApi.login({ username, password });
      localStorage.setItem('access_token', response.access);
      localStorage.setItem('refresh_token', response.refresh);
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
