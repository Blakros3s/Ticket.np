'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { attendanceApi, OfficeSettings } from '@/lib/attendance';

interface Terminology {
  label: string;
  labelPlural: string;
  labelLower: string;
  labelPluralLower: string;
}

interface SettingsContextType {
  settings: OfficeSettings | null;
  loading: boolean;
  error: string | null;
  terminology: Terminology;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<OfficeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const data = await attendanceApi.getOfficeSettings();
      setSettings(data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch settings:', err);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchSettings();
    } else {
      setSettings(null);
      setLoading(false);
    }
  }, [user, fetchSettings]);

  const terminology: Terminology = {
    label: settings?.user_terminology === 'developer' ? 'Developer' : 'Employee',
    labelPlural: settings?.user_terminology === 'developer' ? 'Developers' : 'Employees',
    labelLower: settings?.user_terminology === 'developer' ? 'developer' : 'employee',
    labelPluralLower: settings?.user_terminology === 'developer' ? 'developers' : 'employees',
  };

  return (
    <SettingsContext.Provider
      value={{ 
        settings, 
        loading, 
        error, 
        terminology, 
        refreshSettings: fetchSettings 
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (ctx === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return ctx;
}
