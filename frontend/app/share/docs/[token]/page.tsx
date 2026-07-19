'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { WorkspaceDocRenderer } from '@/components/workspace-doc-renderer';
import { PublicSharedDoc, workspaceDocsApi } from '@/lib/workspace-docs';

export default function PublicSharedDocPage() {
  const params = useParams();
  const token = String(params.token);
  const [doc, setDoc] = useState<PublicSharedDoc | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    workspaceDocsApi.getPublicDoc(token)
      .then(setDoc)
      .catch(() => setError('This link is no longer available.'));
  }, [token]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 workspace-doc-public-shell">
        <div className="surface-panel p-8 max-w-lg text-center">
          <h1 className="text-xl font-semibold mb-2">Document unavailable</h1>
          <p style={{ color: 'var(--text-muted)' }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="min-h-screen flex items-center justify-center workspace-doc-public-shell">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-10 workspace-doc-public-shell">
      <div className="max-w-3xl mx-auto surface-panel p-8">
        <WorkspaceDocRenderer title={doc.title} contentHtml={doc.content_html} />
        <p className="text-xs mt-8" style={{ color: 'var(--text-muted)' }}>
          Read-only shared document · Updated {new Date(doc.updated_at).toLocaleString()}
        </p>
      </div>
      <footer className="workspace-doc-public-footer">Powered by TicketHub</footer>
    </div>
  );
}
