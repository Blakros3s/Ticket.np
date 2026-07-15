'use client';

import { useEffect, useState } from 'react';

export interface DeleteTenantTarget {
  id: number;
  name: string;
  slug: string;
}

export function tenantSlugConfirmed(input: string, expected: string): boolean {
  return input.trim().toLowerCase() === expected.trim().toLowerCase();
}

interface DeleteTenantModalProps {
  tenant: DeleteTenantTarget | null;
  isSubmitting: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onConfirm: (payload: { slug: string; password: string }) => void;
}

export function DeleteTenantModal({
  tenant,
  isSubmitting,
  errorMessage,
  onClose,
  onConfirm,
}: DeleteTenantModalProps) {
  const [slug, setSlug] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (tenant) {
      setSlug('');
      setPassword('');
    }
  }, [tenant]);

  if (!tenant) {
    return null;
  }

  const canSubmit = tenantSlugConfirmed(slug, tenant.slug) && password.length > 0 && !isSubmitting;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onConfirm({
      slug: slug.trim().toLowerCase(),
      password,
    });
  };

  return (
    <div className="modal-overlay" onClick={() => !isSubmitting && onClose()}>
      <div className="modal-panel max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title" style={{ color: 'var(--danger)' }}>Delete organization</h2>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close"
            disabled={isSubmitting}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              This permanently deletes <strong>{tenant.name}</strong>, its PostgreSQL schema, and all
              tenant data. This cannot be undone.
            </p>

            {errorMessage && (
              <div className="server-alert server-alert--error">{errorMessage}</div>
            )}

            <div className="todo-form-field">
              <label htmlFor="purge-slug" className="todo-form-label">
                Type slug to confirm
              </label>
              <input
                id="purge-slug"
                className="input-field font-mono"
                placeholder={tenant.slug}
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                disabled={isSubmitting}
                autoComplete="off"
                autoFocus
              />
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Required slug: <span className="font-mono">{tenant.slug}</span>
              </p>
            </div>

            <div className="todo-form-field">
              <label htmlFor="purge-password" className="todo-form-label">
                Platform console password
              </label>
              <input
                id="purge-password"
                type="password"
                className="input-field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                autoComplete="current-password"
                placeholder="Your /server/login password"
              />
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Use the password for your platform admin account, not a tenant user password.
              </p>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary flex-1" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
              style={{ background: 'var(--danger)' }}
              disabled={!canSubmit}
            >
              {isSubmitting ? 'Deleting…' : 'Delete forever'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
