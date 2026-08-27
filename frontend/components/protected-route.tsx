'use client';

import { useAuth } from '@/lib/auth-context';
import { hasStoredAuthSession } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const restoringSession = isLoading || (hasStoredAuthSession() && !isAuthenticated);

  useEffect(() => {
    if (!restoringSession && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [isAuthenticated, restoringSession, router]);

  if (restoringSession) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
