import api from './api';

export interface GitHubConnectionInfo {
  id: number;
  github_login: string;
  github_user_id: number;
  token_scope: string;
  connected_by_name: string | null;
  connected_at: string;
  updated_at: string;
}

export interface GitHubStatusResponse {
  connected: boolean;
  configured: boolean;
  feature_enabled?: boolean;
  feature_detail?: string;
  connection?: GitHubConnectionInfo;
}

export interface GitHubRepo {
  id: number;
  full_name: string;
  html_url: string;
  private: boolean;
  description: string | null;
}

export const integrationsApi = {
  getGitHubStatus: async (): Promise<GitHubStatusResponse> => {
    const response = await api.get<GitHubStatusResponse>('/integrations/github/status/');
    return response.data;
  },

  connectGitHub: async (): Promise<string> => {
    const response = await api.get<{ authorize_url: string }>('/integrations/github/connect/');
    return response.data.authorize_url;
  },

  disconnectGitHub: async (): Promise<void> => {
    await api.post('/integrations/github/disconnect/');
  },

  listGitHubRepos: async (): Promise<GitHubRepo[]> => {
    const response = await api.get<GitHubRepo[]>('/integrations/github/repos/');
    return response.data;
  },
};
