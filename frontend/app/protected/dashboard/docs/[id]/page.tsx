'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { useProjectSummaries } from '@/lib/data-hooks';
import { ConfirmDialog } from '@/components/confirm-dialog';
import {
  buildDocShareUrl,
  DocShareLink,
  emptyDocContent,
  formatRelativeTime,
  normalizeEditorContent,
  workspaceDocsApi,
  WorkspaceDoc,
  WorkspaceDocContent,
} from '@/lib/workspace-docs';

const WorkspaceDocEditor = dynamic(
  () => import('@/components/workspace-doc-editor').then((mod) => mod.WorkspaceDocEditor),
  {
    ssr: false,
    loading: () => <div className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-400 mx-auto" /></div>,
  },
);

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function WorkspaceDocEditorPage() {
  const params = useParams();
  const router = useRouter();
  const docId = String(params.id);
  const { user } = useAuth();

  const [doc, setDoc] = useState<WorkspaceDoc | null>(null);
  const [title, setTitle] = useState('Untitled');
  const [content, setContent] = useState<WorkspaceDocContent>(emptyDocContent());
  const [projectId, setProjectId] = useState<number | null>(null);
  const { data: projects = [] } = useProjectSummaries();
  const [shareLinks, setShareLinks] = useState<DocShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editorRevision, setEditorRevision] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [shareOpen, setShareOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [staleWarning, setStaleWarning] = useState<string | null>(null);

  const docRef = useRef<WorkspaceDoc | null>(null);
  const savedFadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const suppressDirtyRef = useRef(true);
  const [isDirty, setIsDirty] = useState(false);
  const contentRef = useRef<WorkspaceDocContent>(emptyDocContent());

  const canShare = user?.role === 'admin' || user?.role === 'manager';
  const canDelete = user?.role === 'admin' || doc?.created_by === user?.id;

  useEffect(() => {
    docRef.current = doc;
  }, [doc]);

  const loadDoc = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await workspaceDocsApi.get(docId);
      setDoc(data);
      setTitle(data.title);
      setProjectId(data.project);
      const normalized = normalizeEditorContent(data.content?.type === 'doc' ? data.content : emptyDocContent(), data.title);
      setContent(normalized);
      contentRef.current = normalized;
      setEditorRevision((revision) => revision + 1);
      dirtyRef.current = false;
      setIsDirty(false);
      suppressDirtyRef.current = true;
      setTimeout(() => {
        suppressDirtyRef.current = false;
      }, 600);
    } catch {
      setLoadError('Failed to load document');
    } finally {
      setLoading(false);
    }
  }, [docId]);

  useEffect(() => {
    if (!shareOpen || !canShare) return;
    void workspaceDocsApi.listShareLinks(docId).then(setShareLinks);
  }, [shareOpen, canShare, docId]);

  useEffect(() => {
    void loadDoc();
  }, [loadDoc]);

  const performSave = useCallback(async () => {
    const currentDoc = docRef.current;
    if (!currentDoc || !dirtyRef.current) return;

    setSaveStatus('saving');
    setStaleWarning(null);
    try {
      const updated = await workspaceDocsApi.update(docId, {
        title,
        content: contentRef.current,
        project: projectId,
        expected_updated_at: currentDoc.updated_at,
      });
      setDoc(updated);
      const savedContent = updated.content?.type === 'doc' ? updated.content : contentRef.current;
      setContent(savedContent);
      contentRef.current = savedContent;
      dirtyRef.current = false;
      setIsDirty(false);
      setSaveStatus('saved');
      if (savedFadeRef.current) clearTimeout(savedFadeRef.current);
      savedFadeRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        const payload = error.response as { code?: string; detail?: string } | undefined;
        const detail = error.message;
        if (payload?.code === 'stale_document' || detail.includes('updated by someone else')) {
          setStaleWarning(detail || 'This document was updated elsewhere. Reload to continue.');
        }
      }
      setSaveStatus('error');
    }
  }, [docId, projectId, title]);

  const handleEditorChange = useCallback((payload: { title: string; content: WorkspaceDocContent }) => {
    setTitle(payload.title);
    setContent(payload.content);
    contentRef.current = payload.content;
    if (!suppressDirtyRef.current) {
      dirtyRef.current = true;
      setIsDirty(true);
    }
  }, []);

  const handleProjectChange = useCallback((value: string) => {
    if (!suppressDirtyRef.current) {
      dirtyRef.current = true;
      setIsDirty(true);
    }
    setProjectId(value ? Number(value) : null);
  }, []);

  const handleShareToggle = async (enabled: boolean) => {
    if (!canShare) return;
    if (enabled) {
      setSharing(true);
      try {
        const link = await workspaceDocsApi.createShareLink(docId);
        setShareLinks((prev) => [link, ...prev]);
      } finally {
        setSharing(false);
      }
      return;
    }
    const active = shareLinks[0];
    if (active) {
      await workspaceDocsApi.revokeShareLink(active.id);
      setShareLinks([]);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await workspaceDocsApi.archive(docId);
      router.push('/protected/dashboard/docs');
    } catch {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  const activeShareLink = shareLinks[0] ?? null;

  if (loading) {
    return <div className="page-container p-12 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-400 mx-auto" /></div>;
  }

  if (!doc) {
    return (
      <div className="page-container p-12 text-center">
        <p className="text-slate-400 mb-4">{loadError || 'Document not found'}</p>
        <Link href="/protected/dashboard/docs" className="btn-secondary">Back to docs</Link>
      </div>
    );
  }

  const editorName = doc.last_edited_by_name || doc.created_by_name || 'Someone';

  return (
    <div className="page-container workspace-doc-page">
      <div className="workspace-doc-page__header">
        <div className="flex items-center gap-2 text-sm min-w-0">
          <Link href="/protected/dashboard/docs" className="breadcrumb shrink-0">Docs</Link>
          <span className="text-slate-500 shrink-0">/</span>
          <span className="text-white truncate">{title || 'Untitled'}</span>
        </div>
        <div className="workspace-doc-page__actions">
          {saveStatus === 'saving' && <span className="workspace-doc-page__status">Saving…</span>}
          {saveStatus === 'saved' && <span className="workspace-doc-page__status">Saved</span>}
          {saveStatus === 'error' && <span className="workspace-doc-page__status workspace-doc-page__status--error">Save failed</span>}
          <button
            type="button"
            className="btn-primary"
            onClick={() => void performSave()}
            disabled={!isDirty || saveStatus === 'saving'}
          >
            Save
          </button>
          {canDelete && (
            <button type="button" className="btn-secondary" onClick={() => setDeleteOpen(true)} disabled={deleting}>
              Delete
            </button>
          )}
          {canShare && (
            <div className="relative">
              <button type="button" className="btn-secondary" onClick={() => setShareOpen((open) => !open)}>
                Share
              </button>
              {shareOpen && (
                <>
                  <button type="button" className="workspace-doc-share-backdrop" onClick={() => setShareOpen(false)} aria-label="Close share menu" />
                  <div className="workspace-doc-share-popover">
                    <h3 className="workspace-doc-share-popover__title">Share document</h3>
                    <label className="workspace-doc-share-popover__row">
                      <span>Public link</span>
                      <input
                        type="checkbox"
                        checked={Boolean(activeShareLink)}
                        disabled={sharing}
                        onChange={(event) => void handleShareToggle(event.target.checked)}
                      />
                    </label>
                    {activeShareLink && (
                      <>
                        <p className="workspace-doc-share-popover__hint">
                          Anyone with this link can view — no login required.
                        </p>
                        <div className="workspace-doc-share-popover__copy">
                          <input className="input-field text-sm" readOnly value={buildDocShareUrl(activeShareLink.id)} />
                          <button
                            type="button"
                            className="btn-secondary text-sm"
                            onClick={() => void navigator.clipboard.writeText(buildDocShareUrl(activeShareLink.id))}
                          >
                            Copy
                          </button>
                        </div>
                        {activeShareLink.expires_at && (
                          <p className="workspace-doc-share-popover__meta">
                            Expires {new Date(activeShareLink.expires_at).toLocaleDateString()}
                          </p>
                        )}
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
        </div>
      </div>

      {staleWarning && (
        <div className="server-alert server-alert--error mb-4 flex items-center justify-between gap-4">
          <span>{staleWarning}</span>
          <button type="button" className="btn-secondary" onClick={() => void loadDoc()}>Reload</button>
        </div>
      )}

      <div className="workspace-doc-canvas mb-6">
        <div className="workspace-doc-canvas__top">
          <select
            className="input-field workspace-doc-project-select"
            value={projectId ?? ''}
            onChange={(event) => handleProjectChange(event.target.value)}
          >
            <option value="">Workspace doc</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
        </div>
        <WorkspaceDocEditor
          key={`${docId}-${editorRevision}`}
          defaultContent={content}
          titleFallback={doc.title}
          onChange={handleEditorChange}
        />
        <p className="workspace-doc-canvas__meta">
          Last edited by {editorName}, {formatRelativeTime(doc.updated_at)}
        </p>
      </div>

      <ConfirmDialog
        isOpen={deleteOpen}
        title="Delete document?"
        message="This document will be removed from your workspace. This action cannot be undone."
        confirmText={deleting ? 'Deleting…' : 'Delete'}
        cancelText="Cancel"
        isDestructive
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
