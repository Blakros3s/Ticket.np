'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  PublicSharedWhiteboard,
  workspaceWhiteboardsApi,
} from '@/lib/workspace-whiteboards';

const WorkspaceWhiteboardEditor = dynamic(
  () => import('@/components/workspace-whiteboard-editor').then((mod) => mod.WorkspaceWhiteboardEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-400" />
      </div>
    ),
  },
);

export default function PublicSharedWhiteboardPage() {
  const params = useParams();
  const token = String(params.token);
  const [board, setBoard] = useState<PublicSharedWhiteboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    workspaceWhiteboardsApi.getPublicWhiteboard(token)
      .then(setBoard)
      .catch(() => setError('This link is no longer available.'));
  }, [token]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 workspace-doc-public-shell">
        <div className="surface-panel p-8 max-w-lg text-center">
          <h1 className="text-xl font-semibold mb-2">Whiteboard unavailable</h1>
          <p style={{ color: 'var(--text-muted)' }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="min-h-screen flex items-center justify-center workspace-doc-public-shell">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen workspace-doc-public-shell">
      <header className="flex items-center justify-between h-14 px-4 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] shrink-0">
        <h1 className="text-sm font-medium text-[var(--text-primary)] truncate">{board.title}</h1>
        <span className="text-xs text-[var(--text-muted)] shrink-0">Read-only</span>
      </header>

      <div className="flex flex-1 min-h-0">
        <WorkspaceWhiteboardEditor
          snapshot={board.canvas_data ?? {}}
          revision={0}
          selection={null}
          onSelectionChange={() => {}}
          projectId={null}
          linkedTicket={null}
          converting={false}
          convertError={null}
          onConvert={() => {}}
          readOnly
        />
      </div>

      <footer className="workspace-doc-public-footer">
        Read-only shared whiteboard · Updated {new Date(board.updated_at).toLocaleString()}
      </footer>
    </div>
  );
}
