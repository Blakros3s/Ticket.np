'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { useProjectSummaries, invalidateWorkspaceWhiteboards } from '@/lib/data-hooks';
import type { WhiteboardSelection } from '@/components/workspace-whiteboard-editor';
import {
  buildWhiteboardShareUrl,
  TldrawSnapshot,
  WhiteboardShareLink,
  workspaceWhiteboardsApi,
  Whiteboard,
} from '@/lib/workspace-whiteboards';

const WorkspaceWhiteboardEditor = dynamic(
  () => import('@/components/workspace-whiteboard-editor').then((m) => m.WorkspaceWhiteboardEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
      </div>
    ),
  },
);

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function WorkspaceWhiteboardEditorPage() {
  const params = useParams();
  const router = useRouter();
  const boardId = String(params.id);
  const { user } = useAuth();

  const [board, setBoard] = useState<Whiteboard | null>(null);
  const [title, setTitle] = useState('Untitled');
  const [loadedCanvas, setLoadedCanvas] = useState<TldrawSnapshot>({});
  const getSnapshotRef = useRef<(() => TldrawSnapshot) | null>(null);
  const [projectId, setProjectId] = useState<number | null>(null);
  const { data: projects = [] } = useProjectSummaries();
  const [shareLinks, setShareLinks] = useState<WhiteboardShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editorRevision, setEditorRevision] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [shareOpen, setShareOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [staleWarning, setStaleWarning] = useState<string | null>(null);
  const [selection, setSelection] = useState<WhiteboardSelection>(null);
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [convertTitle, setConvertTitle] = useState('');
  const [copied, setCopied] = useState(false);

  const boardRef = useRef<Whiteboard | null>(null);
  const savedFadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const suppressDirtyRef = useRef(true);
  const [isDirty, setIsDirty] = useState(false);

  const canShare = user?.role === 'admin' || user?.role === 'manager';
  const canDelete = user?.role === 'admin' || board?.created_by === user?.id;
  const linkedTicket = selection?.ticket ?? null;
  const activeShareLink = shareLinks[0] ?? null;

  useEffect(() => { boardRef.current = board; }, [board]);

  const loadBoard = useCallback(async () => {
    if (!boardId || boardId === 'undefined') {
      setLoadError('Invalid whiteboard link');
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const data = await workspaceWhiteboardsApi.get(boardId);
      setBoard(data);
      setTitle(data.title);
      setProjectId(data.project);
      const canvas = data.canvas_data ?? {};
      setLoadedCanvas(canvas);
      setEditorRevision((r) => r + 1);
      dirtyRef.current = false;
      setIsDirty(false);
      suppressDirtyRef.current = true;
      setTimeout(() => { suppressDirtyRef.current = false; }, 600);
    } catch {
      setLoadError('Failed to load whiteboard');
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => { void loadBoard(); }, [loadBoard]);

  useEffect(() => {
    if (!shareOpen || !canShare) return;
    void workspaceWhiteboardsApi.listShareLinks(boardId).then(setShareLinks);
  }, [shareOpen, canShare, boardId]);

  const performSave = useCallback(async () => {
    const current = boardRef.current;
    if (!current || !dirtyRef.current) return;
    const canvasData = getSnapshotRef.current?.() ?? {};
    setSaveStatus('saving');
    setStaleWarning(null);
    try {
      const updated = await workspaceWhiteboardsApi.update(boardId, {
        title,
        canvas_data: canvasData,
        project: projectId,
        expected_updated_at: current.updated_at,
      });
      setBoard(updated);
      dirtyRef.current = false;
      setIsDirty(false);
      setSaveStatus('saved');
      if (savedFadeRef.current) clearTimeout(savedFadeRef.current);
      savedFadeRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        const detail = err.message;
        const payload = err.response as { code?: string } | undefined;
        if (payload?.code === 'stale_whiteboard' || detail.includes('updated by someone else')) {
          setStaleWarning(detail || 'Updated elsewhere — reload to continue.');
          setSaveStatus('error');
          return;
        }
      }
      setSaveStatus('error');
    }
  }, [boardId, projectId, title]);

  const markDirty = useCallback(() => {
    if (!suppressDirtyRef.current) {
      dirtyRef.current = true;
      setIsDirty(true);
    }
  }, []);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!suppressDirtyRef.current) {
      dirtyRef.current = true;
      setIsDirty(true);
    }
  };

  const handleProjectChange = (value: string) => {
    setProjectId(value ? Number(value) : null);
    if (!suppressDirtyRef.current) {
      dirtyRef.current = true;
      setIsDirty(true);
    }
  };

  const handleShareToggle = async (enabled: boolean) => {
    if (!canShare) return;
    if (enabled) {
      setSharing(true);
      try {
        const link = await workspaceWhiteboardsApi.createShareLink(boardId);
        setShareLinks((prev) => [link, ...prev]);
      } finally { setSharing(false); }
      return;
    }
    if (shareLinks[0]) {
      await workspaceWhiteboardsApi.revokeShareLink(shareLinks[0].id);
      setShareLinks([]);
    }
  };

  const handleCopyLink = async () => {
    if (!activeShareLink) return;
    await navigator.clipboard.writeText(buildWhiteboardShareUrl(activeShareLink.id));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeleteBoard = async () => {
    if (!window.confirm('Delete this whiteboard? This cannot be undone.')) return;
    try {
      await workspaceWhiteboardsApi.archive(boardId);
      invalidateWorkspaceWhiteboards();
      router.replace('/protected/dashboard/whiteboards');
    } catch (err: unknown) {
      if (err instanceof ApiError && err.statusCode === 404) {
        invalidateWorkspaceWhiteboards();
        router.replace('/protected/dashboard/whiteboards');
        return;
      }
      window.alert('Could not delete this whiteboard.');
    }
  };

  const noteTextFromSelection = (sel: WhiteboardSelection): string => {
    if (!sel || sel.type !== 'note') return '';
    const text = sel.props.text;
    if (typeof text === 'string' && text.trim()) return text.trim();
    return '';
  };

  const openConvertModal = () => {
    if (!selection?.ids[0] || selection.type !== 'note' || linkedTicket || !projectId) return;
    setConvertError(null);
    setConvertTitle(noteTextFromSelection(selection) || 'Untitled');
    setConvertModalOpen(true);
  };

  const handleConvertNote = async () => {
    if (!selection?.ids[0] || selection.type !== 'note' || linkedTicket || !projectId) return;
    const trimmedTitle = convertTitle.trim() || 'Untitled';
    setConverting(true);
    setConvertError(null);
    try {
      const result = await workspaceWhiteboardsApi.convertElement(
        boardId,
        selection.ids[0],
        trimmedTitle,
      );
      setLoadedCanvas(result.canvas_data);
      setBoard((prev) => prev ? { ...prev, canvas_data: result.canvas_data, updated_at: result.updated_at } : prev);
      setEditorRevision((r) => r + 1);
      setSelection({ ...selection, ticket: { id: result.ticket.id, ticketId: result.ticket.ticket_id } });
      dirtyRef.current = false;
      setIsDirty(false);
      setConvertModalOpen(false);
    } catch (err: unknown) {
      setConvertError(err instanceof ApiError ? err.message : 'Failed to convert note');
    } finally {
      setConverting(false);
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        void performSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [performSave]);

  useEffect(() => {
    return () => {
      if (savedFadeRef.current) clearTimeout(savedFadeRef.current);
    };
  }, []);

  if (loading) {
    return (
      <div className="page-container p-12 text-center">
        <div className="w-6 h-6 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin mx-auto" />
      </div>
    );
  }

  if (!board) {
    return (
      <div className="page-container p-12 text-center">
        <p className="text-sm text-[var(--text-muted)] mb-4">{loadError ?? 'Whiteboard not found'}</p>
        <Link href="/protected/dashboard/whiteboards" className="btn-secondary text-sm">
          Back to whiteboards
        </Link>
      </div>
    );
  }

  return (
    <div className="page-container workspace-whiteboard-page">
      <div className="workspace-doc-page__header">
        <div className="flex items-center gap-2 text-sm min-w-0">
          <Link href="/protected/dashboard/whiteboards" className="breadcrumb shrink-0">Whiteboards</Link>
          <span className="text-[var(--text-muted)] shrink-0">/</span>
          <input
            className="min-w-0 flex-1 bg-transparent border-none text-[var(--text-primary)] font-medium outline-none focus:ring-0 truncate"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            aria-label="Whiteboard title"
            placeholder="Untitled"
          />
        </div>
        <div className="workspace-doc-page__actions">
          {saveStatus === 'saving' && <span className="workspace-doc-page__status">Saving…</span>}
          {saveStatus === 'saved' && <span className="workspace-doc-page__status">Saved</span>}
          {saveStatus === 'error' && !staleWarning && (
            <span className="workspace-doc-page__status workspace-doc-page__status--error">Save failed</span>
          )}
          <button
            type="button"
            className="btn-primary"
            onClick={() => void performSave()}
            disabled={saveStatus === 'saving' || !isDirty}
          >
            Save
          </button>
          {canShare && (
            <div className="relative">
              <button type="button" className="btn-secondary" onClick={() => setShareOpen((v) => !v)}>
                Share
              </button>
              {shareOpen && (
                <>
                  <button
                    type="button"
                    className="workspace-doc-share-backdrop"
                    aria-label="Close"
                    onClick={() => setShareOpen(false)}
                  />
                  <div className="workspace-doc-share-popover">
                    <h3 className="workspace-doc-share-popover__title">Share whiteboard</h3>
                    <label className="workspace-doc-share-popover__row">
                      <span>Public link</span>
                      <input
                        type="checkbox"
                        checked={Boolean(activeShareLink)}
                        disabled={sharing}
                        onChange={(e) => void handleShareToggle(e.target.checked)}
                      />
                    </label>
                    {activeShareLink && (
                      <>
                        <p className="workspace-doc-share-popover__hint">
                          Anyone with this link can view — no login required.
                        </p>
                        <div className="workspace-doc-share-popover__copy">
                          <input className="input-field text-sm" readOnly value={buildWhiteboardShareUrl(activeShareLink.id)} />
                          <button type="button" className="btn-secondary text-sm" onClick={() => void handleCopyLink()}>
                            {copied ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        <button
                          type="button"
                          className="btn-secondary text-sm w-full mt-2"
                          onClick={() => void handleShareToggle(false)}
                        >
                          Revoke link
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
          {canDelete && (
            <button type="button" className="btn-secondary" onClick={() => void handleDeleteBoard()}>
              Delete
            </button>
          )}
        </div>
      </div>

      {staleWarning && (
        <div className="server-alert server-alert--error mb-4 flex items-center justify-between gap-4">
          <span>{staleWarning}</span>
          <button type="button" className="btn-secondary" onClick={() => void loadBoard()}>
            Reload
          </button>
        </div>
      )}

      <div className="workspace-whiteboard-shell mb-6">
        <div className="workspace-doc-canvas__top">
          <select
            className="input-field workspace-doc-project-select"
            value={projectId ?? ''}
            onChange={(e) => handleProjectChange(e.target.value)}
            aria-label="Project"
          >
            <option value="">Workspace whiteboard</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <WorkspaceWhiteboardEditor
          snapshot={loadedCanvas}
          revision={editorRevision}
          onDirty={markDirty}
          getSnapshotRef={getSnapshotRef}
          selection={selection}
          onSelectionChange={setSelection}
          projectId={projectId}
          linkedTicket={linkedTicket}
          converting={converting}
          convertError={convertError}
          onConvert={openConvertModal}
        />
      </div>

      {/* Convert to ticket modal */}
      {convertModalOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-50 bg-black/30"
            aria-label="Close"
            onClick={() => !converting && setConvertModalOpen(false)}
          />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl shadow-xl p-5">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Create ticket from note</h2>
            <p className="text-xs text-[var(--text-muted)] mb-4">
              A new ticket will be created in the linked project.
            </p>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5" htmlFor="convert-title">
              Title
            </label>
            <input
              id="convert-title"
              className="w-full text-sm px-3 py-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-base)] text-[var(--text-primary)] mb-3"
              value={convertTitle}
              onChange={(e) => setConvertTitle(e.target.value)}
              disabled={converting}
              autoFocus
            />
            {convertError && (
              <p className="text-xs text-[var(--danger)] mb-3">{convertError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="text-xs px-3 py-1.5 rounded-md border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] transition-colors"
                onClick={() => setConvertModalOpen(false)}
                disabled={converting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="text-xs px-3 py-1.5 rounded-md bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
                onClick={() => void handleConvertNote()}
                disabled={converting || !convertTitle.trim()}
              >
                {converting ? 'Creating…' : 'Create ticket'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
