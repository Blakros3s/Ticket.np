import api from './api';

export interface Project {
  id: number;
  name: string;
  description: string;
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
  created_at: string;
  updated_at: string;
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
  };
  joined_at: string;
}

export interface CreateProjectData {
  name: string;
  description: string;
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
    const response = await api.get<Project[]>('/projects/projects/my_projects/');
    return response.data;
  },
};
