'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { ErrorModal, extractErrorMessage } from '@/components/error-modal';
import { ThemeToggle } from '@/components/theme-toggle';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [statusCode, setStatusCode] = useState<number | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push('/protected/dashboard');
    }
  }, [isAuthenticated, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setStatusCode(undefined);
    setShowErrorModal(false);
    setIsLoading(true);

    try {
      await login(username, password);
      router.push('/protected/dashboard');
    } catch (err: unknown) {
      const { message, statusCode: code } = extractErrorMessage(err);
      setError(message);
      setStatusCode(code);
      setShowErrorModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseModal = () => {
    setShowErrorModal(false);
    setError('');
    setStatusCode(undefined);
  };

  const handleRetry = () => {
    setUsername('');
    setPassword('');
    setTimeout(() => {
      document.getElementById('username')?.focus();
    }, 100);
  };

  return (
    <div className="min-h-screen grid-bg flex items-center justify-center px-4 py-12 relative">
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div
            className="w-14 h-14 rounded-xl mx-auto mb-5 flex items-center justify-center"
            style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
              />
            </svg>
          </div>
          <h1 className="page-title text-3xl">Sign in to TicketHub</h1>
          <p className="page-subtitle mt-2">Use your username and password</p>
        </div>

        <div className="card p-8 shadow-sm" style={{ boxShadow: 'var(--shadow-sm)' }}>
          {error && !showErrorModal && (
            <div
              className="mb-6 p-4 rounded-lg text-sm"
              style={{
                background: 'var(--danger-muted)',
                color: 'var(--danger)',
                border: '1px solid var(--border-default)',
              }}
            >
              {error}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="username" className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-field"
                placeholder="mike.brown@technest.com"
              />
              <p className="mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                Enter your full username, e.g. mike.brown@technest.com
              </p>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
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
              {isLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-sm mt-6" style={{ color: 'var(--text-muted)' }}>
            Platform administrator?{' '}
            <Link href="/server/login" className="server-link">
              Server console
            </Link>
          </p>
        </div>
      </div>

      <ErrorModal
        isOpen={showErrorModal}
        onClose={handleCloseModal}
        title="Authentication Failed"
        message={error}
        statusCode={statusCode}
        onRetry={handleRetry}
        retryText="Try Again"
      />
    </div>
  );
}
