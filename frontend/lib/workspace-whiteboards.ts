import api from './api';
import { buildQueryString, normalizeListResponse } from './http-utils';
import type { WhiteboardCanvasData } from './whiteboard-canvas';

/** @deprecated Use WhiteboardCanvasData */
export type TldrawSnapshot = WhiteboardCanvasData;
export type { WhiteboardCanvasData };

export interface Whiteboard {
  id: string;
  title: string;
  canvas_data: WhiteboardCanvasData;
  project: number | null;
  project_name?: string | null;
  created_by: number;
  created_by_name?: string;
  last_edited_by?: number | null;
  last_edited_by_name?: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface WhiteboardListItem {
  id: string;
  title: string;
  project: number | null;
  project_name?: string | null;
  created_by: number;
  created_by_name?: string;
  last_edited_by?: number | null;
  last_edited_by_name?: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConvertElementResult {
  ticket: {
    id: number;
    ticket_id: string;
    title: string;
  };
  canvas_data: WhiteboardCanvasData;
  updated_at: string;
}

export interface WhiteboardShareLink {
  id: string;
  whiteboard: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  public_url?: string;
}

export interface PublicSharedWhiteboard {
  title: string;
  canvas_data: WhiteboardCanvasData;
  updated_at: string;
}

/** Public whiteboard share URL using the current frontend origin (dev vs prod). */
export function buildWhiteboardShareUrl(token: string): string {
  const base =
    typeof window !== 'undefined'
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  return `${base}/share/whiteboards/${token}`;
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

export const workspaceWhiteboardsApi = {
  list: async (params?: {
    project?: number;
    workspace_only?: boolean;
    q?: string;
  }): Promise<WhiteboardListItem[]> => {
    const query = buildQueryString({
      project: params?.project,
      workspace_only: params?.workspace_only ? 'true' : undefined,
      q: params?.q?.trim() || undefined,
    });
    const response = await api.get<WhiteboardListItem[] | { results: WhiteboardListItem[] }>(
      `/workspace-whiteboards/whiteboards/${query}`,
    );
    return normalizeListResponse(response.data);
  },

  get: async (id: string): Promise<Whiteboard> => {
    const response = await api.get<Whiteboard>(`/workspace-whiteboards/whiteboards/${id}/`);
    return response.data;
  },

  create: async (data: { title?: string; canvas_data?: WhiteboardCanvasData; project?: number | null }): Promise<Whiteboard> => {
    const response = await api.post<Whiteboard>('/workspace-whiteboards/whiteboards/', {
      title: data.title ?? 'Untitled',
      canvas_data: data.canvas_data ?? {},
      project: data.project ?? null,
    });
    return response.data;
  },

  update: async (
    id: string,
    data: Partial<{
      title: string;
      canvas_data: WhiteboardCanvasData;
      project: number | null;
      expected_updated_at: string;
    }>,
  ): Promise<Whiteboard> => {
    const response = await api.patch<Whiteboard>(`/workspace-whiteboards/whiteboards/${id}/`, data);
    return response.data;
  },

  archive: async (id: string): Promise<void> => {
    await api.delete(`/workspace-whiteboards/whiteboards/${id}/`);
  },

  convertElement: async (
    id: string,
    elementId: string,
    title?: string,
  ): Promise<ConvertElementResult> => {
    const response = await api.post<ConvertElementResult>(
      `/workspace-whiteboards/whiteboards/${id}/convert-element/`,
      { element_id: elementId, ...(title ? { title } : {}) },
    );
    return response.data;
  },

  createShareLink: async (id: string, expires_at?: string | null): Promise<WhiteboardShareLink> => {
    const response = await api.post<WhiteboardShareLink>(
      `/workspace-whiteboards/whiteboards/${id}/share/`,
      expires_at ? { expires_at } : {},
    );
    return response.data;
  },

  listShareLinks: async (id: string): Promise<WhiteboardShareLink[]> => {
    const response = await api.get<WhiteboardShareLink[]>(
      `/workspace-whiteboards/whiteboards/${id}/share_links/`,
    );
    return response.data;
  },

  revokeShareLink: async (linkId: string): Promise<void> => {
    await api.delete(`/workspace-whiteboards/share/${linkId}/`);
  },

  getPublicWhiteboard: async (token: string): Promise<PublicSharedWhiteboard> => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
    const response = await fetch(`${API_URL}/public/share/whiteboards/${token}/`);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error((body as { detail?: string }).detail || 'Failed to load shared whiteboard');
    }
    return response.json();
  },
};
