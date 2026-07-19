'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatRelativeTime, workspaceDocsApi } from '@/lib/workspace-docs';
import { invalidateWorkspaceDocs, useProjectSummaries, useWorkspaceDocs } from '@/lib/data-hooks';

type SidebarFilter = 'all' | 'starred' | 'recent' | number | 'workspace';

export default function WorkspaceDocsListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialProject = searchParams.get('project') ? Number(searchParams.get('project')) : null;

  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sidebarFilter, setSidebarFilter] = useState<SidebarFilter>(
    initialProject ?? 'all',
  );

  const { data: projects = [] } = useProjectSummaries();

  const docFilters = useMemo(
    () => ({
      project: typeof sidebarFilter === 'number' ? sidebarFilter : undefined,
      workspace_only: sidebarFilter === 'workspace',
      starred: sidebarFilter === 'starred',
      q: debouncedSearch || undefined,
    }),
    [sidebarFilter, debouncedSearch],
  );

  const { data: docs = [], isLoading: loading } = useWorkspaceDocs(docFilters);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const visibleDocs = useMemo(() => {
    if (sidebarFilter !== 'recent') return docs;
    return [...docs]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 20);
  }, [docs, sidebarFilter]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const doc = await workspaceDocsApi.create({
        title: 'Untitled',
        project: typeof sidebarFilter === 'number' ? sidebarFilter : null,
      });
      if (!doc.id) {
        throw new Error('Document created without an id');
      }
      router.push(`/protected/dashboard/docs/${doc.id}`);
    } catch {
      setCreating(false);
    }
  };

  const toggleStar = async (event: React.MouseEvent, doc: (typeof docs)[number]) => {
    event.preventDefault();
    event.stopPropagation();
    if (doc.is_starred) {
      await workspaceDocsApi.unstar(doc.id);
    } else {
      await workspaceDocsApi.star(doc.id);
    }
    invalidateWorkspaceDocs();
  };

  const sidebarItemClass = (active: boolean) =>
    `workspace-doc-sidebar__item ${active ? 'is-active' : ''}`;

  return (
    <div className="page-container workspace-docs-layout">
      <aside className="workspace-doc-sidebar">
        <p className="workspace-doc-sidebar__heading">Browse</p>
        <button type="button" className={sidebarItemClass(sidebarFilter === 'all')} onClick={() => setSidebarFilter('all')}>
          All docs
        </button>
        <button type="button" className={sidebarItemClass(sidebarFilter === 'starred')} onClick={() => setSidebarFilter('starred')}>
          Starred
        </button>
        <button type="button" className={sidebarItemClass(sidebarFilter === 'recent')} onClick={() => setSidebarFilter('recent')}>
          Recent
        </button>
        <button type="button" className={sidebarItemClass(sidebarFilter === 'workspace')} onClick={() => setSidebarFilter('workspace')}>
          Workspace
        </button>
        {projects.length > 0 && (
          <>
            <p className="workspace-doc-sidebar__heading mt-4">Projects</p>
            {projects.map((project) => (
              <button
                key={project.id}
                type="button"
                className={sidebarItemClass(sidebarFilter === project.id)}
                onClick={() => setSidebarFilter(project.id)}
              >
                {project.name}
              </button>
            ))}
          </>
        )}
      </aside>

      <section className="workspace-docs-main">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-title text-3xl font-bold">Docs</h1>
            <p className="page-subtitle mt-1">Notes, specs, and guides for your workspace</p>
          </div>
          <button type="button" className="btn-primary" onClick={() => void handleCreate()} disabled={creating}>
            {creating ? 'Creating…' : 'New Doc'}
          </button>
        </div>

        <input
          type="search"
          className="input-field w-full mb-6"
          placeholder="Search docs…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        {loading ? (
          <div className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-400 mx-auto" /></div>
        ) : visibleDocs.length === 0 ? (
          <div className="workspace-doc-empty">
            <p className="workspace-doc-empty__title">No docs yet — write your first one.</p>
            <button type="button" className="btn-primary btn-lg" onClick={() => void handleCreate()} disabled={creating}>
              {creating ? 'Creating…' : 'New Doc'}
            </button>
          </div>
        ) : (
          <ul className="workspace-doc-list">
            {visibleDocs.map((doc) => (
              <li key={doc.id}>
                <Link href={`/protected/dashboard/docs/${doc.id}`} className="workspace-doc-list__row">
                  <div className="workspace-doc-list__body">
                    <p className="workspace-doc-list__title">{doc.title || 'Untitled'}</p>
                    <p className="workspace-doc-list__meta">
                      {doc.last_edited_by_name || doc.created_by_name} · {formatRelativeTime(doc.updated_at)}
                      {doc.project_name ? ` · ${doc.project_name}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={`workspace-doc-list__star ${doc.is_starred ? 'is-starred' : ''}`}
                    onClick={(event) => void toggleStar(event, doc)}
                    aria-label={doc.is_starred ? 'Unstar doc' : 'Star doc'}
                  >
                    {doc.is_starred ? '★' : '☆'}
                  </button>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
