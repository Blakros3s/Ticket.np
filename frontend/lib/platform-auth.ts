import platformApi, { PLATFORM_ACCESS_KEY, PLATFORM_REFRESH_KEY } from './platform-api';

export interface PlatformUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'server_admin';
  is_active: boolean;
}

export interface PlatformLoginCredentials {
  username: string;
  password: string;
}

export interface PlatformAuthResponse {
  access: string;
  refresh: string;
  user: PlatformUser;
}

export const platformAuthApi = {
  login: async (credentials: PlatformLoginCredentials): Promise<PlatformAuthResponse> => {
    const response = await platformApi.post<PlatformAuthResponse>('auth/login/', credentials);
    return response.data;
  },

  getProfile: async (): Promise<PlatformUser> => {
    const response = await platformApi.get<PlatformUser>('auth/profile/');
    return response.data;
  },

  logout: (): void => {
    localStorage.removeItem(PLATFORM_ACCESS_KEY);
    localStorage.removeItem(PLATFORM_REFRESH_KEY);
  },
};
