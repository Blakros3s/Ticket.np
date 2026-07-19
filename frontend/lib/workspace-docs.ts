import api from './api';
import { buildQueryString, normalizeListResponse } from './http-utils';

export interface WorkspaceDocContent {
  type: 'doc';
  content: Array<Record<string, unknown>>;
}

export interface WorkspaceDoc {
  id: string;
  title: string;
  emoji: string;
  content: WorkspaceDocContent;
  project: number | null;
  project_name?: string | null;
  created_by: number;
  created_by_name?: string;
  last_edited_by?: number | null;
  last_edited_by_name?: string | null;
  is_starred?: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceDocListItem {
  id: string;
  title: string;
  emoji: string;
  project: number | null;
  project_name?: string | null;
  created_by: number;
  created_by_name?: string;
  last_edited_by?: number | null;
  last_edited_by_name?: string | null;
  is_starred?: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface DocShareLink {
  id: string;
  doc: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  public_url: string;
}

export interface PublicSharedDoc {
  title: string;
  content: WorkspaceDocContent;
  content_html: string;
  updated_at: string;
}

/** Public doc share URL using the current frontend origin (dev vs prod). */
export function buildDocShareUrl(token: string): string {
  const base =
    typeof window !== 'undefined'
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  return `${base}/share/docs/${token}`;
}

export const emptyDocContent = (): WorkspaceDocContent => ({
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 } },
    { type: 'paragraph' },
  ],
});

export function extractTitleFromContent(content: WorkspaceDocContent): string {
  const first = content.content?.[0];
  if (first?.type === 'heading' && (first.attrs as { level?: number } | undefined)?.level === 1) {
    const textNodes = (first.content as Array<{ type?: string; text?: string }>) ?? [];
    const text = textNodes.filter((node) => node.type === 'text').map((node) => node.text ?? '').join('');
    return text.trim() || 'Untitled';
  }
  return 'Untitled';
}

export function normalizeEditorContent(content: WorkspaceDocContent | undefined, titleFallback = 'Untitled'): WorkspaceDocContent {
  if (!content?.content?.length) {
    return emptyDocContent();
  }
  const first = content.content[0];
  if (first?.type === 'heading' && (first.attrs as { level?: number } | undefined)?.level === 1) {
    return content;
  }
  return {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: titleFallback ? [{ type: 'text', text: titleFallback }] : [] },
      ...content.content,
    ],
  };
}

export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export const workspaceDocsApi = {
  list: async (params?: {
    project?: number;
    workspace_only?: boolean;
    starred?: boolean;
    q?: string;
  }): Promise<WorkspaceDocListItem[]> => {
    const query = buildQueryString({
      project: params?.project,
      workspace_only: params?.workspace_only ? 'true' : undefined,
      starred: params?.starred ? 'true' : undefined,
      q: params?.q?.trim() || undefined,
    });
    const response = await api.get<WorkspaceDocListItem[] | { results: WorkspaceDocListItem[] }>(
      `/workspace-docs/docs/${query}`,
    );
    return normalizeListResponse(response.data);
  },

  get: async (id: string): Promise<WorkspaceDoc> => {
    const response = await api.get<WorkspaceDoc>(`/workspace-docs/docs/${id}/`);
    return response.data;
  },

  create: async (data: { title?: string; emoji?: string; content?: WorkspaceDocContent; project?: number | null }): Promise<WorkspaceDoc> => {
    const response = await api.post<WorkspaceDoc>('/workspace-docs/docs/', {
      title: data.title ?? 'Untitled',
      emoji: data.emoji ?? '',
      content: data.content ?? emptyDocContent(),
      project: data.project ?? null,
    });
    return response.data;
  },

  update: async (
    id: string,
    data: Partial<{
      title: string;
      emoji: string;
      content: WorkspaceDocContent;
      project: number | null;
      expected_updated_at: string;
    }>,
  ): Promise<WorkspaceDoc> => {
    const response = await api.patch<WorkspaceDoc>(`/workspace-docs/docs/${id}/`, data);
    return response.data;
  },

  archive: async (id: string): Promise<void> => {
    await api.delete(`/workspace-docs/docs/${id}/`);
  },

  createShareLink: async (id: string, expires_at?: string | null): Promise<DocShareLink> => {
    const response = await api.post<DocShareLink>(`/workspace-docs/docs/${id}/share/`, { expires_at });
    return response.data;
  },

  listShareLinks: async (id: string): Promise<DocShareLink[]> => {
    const response = await api.get<DocShareLink[]>(`/workspace-docs/docs/${id}/share_links/`);
    return response.data;
  },

  revokeShareLink: async (linkId: string): Promise<void> => {
    await api.delete(`/workspace-docs/share/${linkId}/`);
  },

  star: async (id: string): Promise<void> => {
    await api.post(`/workspace-docs/docs/${id}/star/`);
  },

  unstar: async (id: string): Promise<void> => {
    await api.post(`/workspace-docs/docs/${id}/unstar/`);
  },

  getPublicDoc: async (token: string): Promise<PublicSharedDoc> => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
    const response = await fetch(`${API_URL}/public/share/docs/${token}/`);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error((body as { detail?: string }).detail || 'Failed to load shared document');
    }
    return response.json();
  },
};
