'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/theme-toggle';
import { ErrorModal, extractErrorMessage } from '@/components/error-modal';
import { usePlatformAuth } from '@/lib/platform-auth-context';

export default function ServerLoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [statusCode, setStatusCode] = useState<number | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const { login, isAuthenticated, isLoading: authLoading } = usePlatformAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push('/server/dashboard');
    }
  }, [authLoading, isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setStatusCode(undefined);
    setShowErrorModal(false);
    setIsLoading(true);

    try {
      await login(username, password);
      router.push('/server/dashboard');
    } catch (err: unknown) {
      const { message, statusCode: code } = extractErrorMessage(err);
      setError(message);
      setStatusCode(code);
      setShowErrorModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid-bg flex items-center justify-center px-4 py-12 relative">
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="server-login-badge mx-auto mb-5">Platform</div>
          <h1 className="page-title text-3xl">Server Console</h1>
          <p className="page-subtitle mt-2">Sign in with your platform administrator account</p>
        </div>

        <div className="card p-8 shadow-sm" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="platform-username" className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                Username
              </label>
              <input
                id="platform-username"
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-field"
                placeholder="platform-admin"
              />
            </div>

            <div>
              <label htmlFor="platform-password" className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                Password
              </label>
              <div className="relative">
                <input
                  id="platform-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pr-12"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm"
                  style={{ color: 'var(--text-muted)' }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  disabled={isLoading}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button type="submit" disabled={isLoading} className="btn-primary w-full py-3">
              {isLoading ? 'Signing in…' : 'Sign in to console'}
            </button>
          </form>

          <p className="text-center text-sm mt-6" style={{ color: 'var(--text-muted)' }}>
            Organization user?{' '}
            <Link href="/auth/login" className="server-link">
              Sign in to TicketHub
            </Link>
          </p>
        </div>
      </div>

      <ErrorModal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        title="Authentication Failed"
        message={error}
        statusCode={statusCode}
        onRetry={() => {
          setUsername('');
          setPassword('');
          setShowErrorModal(false);
        }}
        retryText="Try Again"
      />
    </div>
  );
}
