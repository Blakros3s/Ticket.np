import api from './api';
import { UserRole } from './auth';

export interface Project {
  id: number;
  name: string;
  description: string;
  github_repo: string | null;
  status: 'active' | 'archived';
  created_by: {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
  };
  members: ProjectMember[];
  member_count: number;
  ticket_count: number;
  document_count: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectDocument {
  id: number;
  title: string;
  file: string;
  file_type: string;
  file_size: number;
  uploaded_by: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
  };
  created_at: string;
}

export interface ProjectMember {
  id: number;
  user: {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
    department_roles?: UserRole[];
  };
  joined_at: string;
}

export interface CreateProjectData {
  name: string;
  description: string;
  github_repo?: string;
  status?: 'active' | 'archived';
}

export const projectsApi = {
  getProjects: async (): Promise<Project[]> => {
    const response = await api.get<Project[] | { results: Project[] }>('/projects/projects/');
    // Handle both direct array and { results: array } formats
    const data = response.data;
    if (Array.isArray(data)) {
      return data;
    }
    if (data && typeof data === 'object' && 'results' in data) {
      return data.results;
    }
    return [];
  },

  getProject: async (id: number): Promise<Project> => {
    const response = await api.get<Project>(`/projects/projects/${id}/`);
    return response.data;
  },

  createProject: async (data: CreateProjectData): Promise<Project> => {
    const response = await api.post<Project>('/projects/projects/', data);
    return response.data;
  },

  updateProject: async (id: number, data: Partial<CreateProjectData>): Promise<Project> => {
    const response = await api.patch<Project>(`/projects/projects/${id}/`, data);
    return response.data;
  },

  deleteProject: async (id: number): Promise<void> => {
    await api.delete(`/projects/projects/${id}/`);
  },

  addMember: async (projectId: number, userId: number): Promise<ProjectMember> => {
    const response = await api.post<ProjectMember>(`/projects/projects/${projectId}/add_member/`, {
      user_id: userId,
    });
    return response.data;
  },

  removeMember: async (projectId: number, userId: number): Promise<void> => {
    await api.post(`/projects/projects/${projectId}/remove_member/`, {
      user_id: userId,
    });
  },

  getMyProjects: async (): Promise<Project[]> => {
    const response = await api.get<Project[] | { results: Project[] }>('/projects/projects/my_projects/');
    const data = response.data;
    if (Array.isArray(data)) {
      return data;
    }
    if (data && typeof data === 'object' && 'results' in data) {
      return data.results;
    }
    return [];
  },

  getDocuments: async (projectId: number): Promise<ProjectDocument[]> => {
    const response = await api.get<ProjectDocument[] | { results: ProjectDocument[] }>(`/projects/projects/${projectId}/documents/`);
    const data = response.data;
    if (Array.isArray(data)) {
      return data;
    }
    if (data && typeof data === 'object' && 'results' in data) {
      return data.results;
    }
    return [];
  },

  uploadDocument: async (projectId: number, formData: FormData): Promise<ProjectDocument> => {
    const response = await api.post<ProjectDocument>(
      `/projects/projects/${projectId}/documents/`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  },

  deleteDocument: async (projectId: number, documentId: number): Promise<void> => {
    await api.delete(`/projects/projects/${projectId}/documents/${documentId}/`);
  },
};
