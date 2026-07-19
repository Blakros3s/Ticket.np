'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { formatRelativeTime, workspaceWhiteboardsApi } from '@/lib/workspace-whiteboards';
import { invalidateWorkspaceWhiteboards, useProjectSummaries, useWorkspaceWhiteboards } from '@/lib/data-hooks';
import { ApiError } from '@/lib/api';

type SidebarFilter = 'all' | 'recent' | 'workspace' | number;

export default function WorkspaceWhiteboardsListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialProject = searchParams.get('project') ? Number(searchParams.get('project')) : null;

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sidebarFilter, setSidebarFilter] = useState<SidebarFilter>(initialProject ?? 'all');

  const { data: projects = [] } = useProjectSummaries();

  const boardFilters = useMemo(() => ({
    project: typeof sidebarFilter === 'number' ? sidebarFilter : undefined,
    workspace_only: sidebarFilter === 'workspace',
    q: debouncedSearch || undefined,
  }), [sidebarFilter, debouncedSearch]);

  const { data: whiteboards = [], isLoading: loading } = useWorkspaceWhiteboards(boardFilters);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const visibleBoards = useMemo(() => {
    if (sidebarFilter !== 'recent') return whiteboards;
    return [...whiteboards]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 20);
  }, [whiteboards, sidebarFilter]);

  const handleCreate = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const board = await workspaceWhiteboardsApi.create({
        title: 'Untitled',
        project: typeof sidebarFilter === 'number' ? sidebarFilter : null,
      });
      if (!board?.id) throw new Error('Created without id');
      invalidateWorkspaceWhiteboards();
      router.replace(`/protected/dashboard/whiteboards/${board.id}`);
    } catch {
      setCreateError('Could not create whiteboard. Please try again.');
      setCreating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, boardId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm('Delete this whiteboard? This cannot be undone.')) return;
    try {
      await workspaceWhiteboardsApi.archive(boardId);
    } catch (err: unknown) {
      if (!(err instanceof ApiError) || err.statusCode !== 404) {
        window.alert('Could not delete this whiteboard.');
        return;
      }
    }
    invalidateWorkspaceWhiteboards();
  };

  const sidebarItemClass = (active: boolean) =>
    `workspace-doc-sidebar__item ${active ? 'is-active' : ''}`;

  return (
    <div className="page-container workspace-docs-layout">
      <aside className="workspace-doc-sidebar">
        <p className="workspace-doc-sidebar__heading">Browse</p>
        <button type="button" className={sidebarItemClass(sidebarFilter === 'all')} onClick={() => setSidebarFilter('all')}>
          All whiteboards
        </button>
        <button type="button" className={sidebarItemClass(sidebarFilter === 'recent')} onClick={() => setSidebarFilter('recent')}>
          Recently edited
        </button>
        <button type="button" className={sidebarItemClass(sidebarFilter === 'workspace')} onClick={() => setSidebarFilter('workspace')}>
          Workspace
        </button>

        {projects.length > 0 && (
          <>
            <p className="workspace-doc-sidebar__heading mt-4">Projects</p>
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                className={sidebarItemClass(sidebarFilter === p.id)}
                onClick={() => setSidebarFilter(p.id)}
              >
                {p.name}
              </button>
            ))}
          </>
        )}
      </aside>

      <section className="min-w-0">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-title text-3xl font-bold">Whiteboards</h1>
            <p className="page-subtitle mt-1">Sketch ideas, flows, and diagrams</p>
          </div>
          <button type="button" className="btn-primary" onClick={() => void handleCreate()} disabled={creating}>
            {creating ? 'Creating…' : 'New whiteboard'}
          </button>
        </div>

        <input
          type="search"
          className="input-field w-full mb-6"
          placeholder="Search whiteboards…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {createError && (
          <p className="text-sm text-[var(--danger)] mb-4">{createError}</p>
        )}

        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-400 mx-auto" />
          </div>
        ) : visibleBoards.length === 0 ? (
          <div className="workspace-doc-empty">
            <p className="workspace-doc-empty__title">
              {debouncedSearch ? 'No whiteboards match your search.' : 'No whiteboards yet — create your first one.'}
            </p>
            {!debouncedSearch && (
              <button type="button" className="btn-primary btn-lg" onClick={() => void handleCreate()} disabled={creating}>
                {creating ? 'Creating…' : 'New whiteboard'}
              </button>
            )}
          </div>
        ) : (
          <div className="workspace-whiteboard-grid">
            {visibleBoards.map((board) => (
              <div key={board.id} className="group relative">
                <Link href={`/protected/dashboard/whiteboards/${board.id}`} className="workspace-whiteboard-card">
                  <div className="workspace-whiteboard-card__preview" aria-hidden="true" />
                  <div className="workspace-whiteboard-card__body">
                    <p className="workspace-whiteboard-card__title">{board.title || 'Untitled'}</p>
                    <p className="workspace-whiteboard-card__meta">
                      {formatRelativeTime(board.updated_at)}
                      {board.last_edited_by_name ? ` · ${board.last_edited_by_name}` : ''}
                    </p>
                    {board.project_name && (
                      <span className="workspace-whiteboard-card__tag">{board.project_name}</span>
                    )}
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={(e) => void handleDelete(e, board.id)}
                  aria-label="Delete whiteboard"
                  className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-muted)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] transition-all"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
