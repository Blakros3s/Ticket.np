import axios, { AxiosError } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
export const TENANT_SCHEMA_KEY = 'tenant_schema';

// Custom error class for API errors
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public errors?: Record<string, string[]>,
    public response?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

let isRefreshing = false;
let refreshPromise: Promise<string> | null = null;

const requestNewAccessToken = async (): Promise<string> => {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) {
    throw new Error('No refresh token');
  }

  const headers: Record<string, string> = {};
  const tenantSchema = localStorage.getItem(TENANT_SCHEMA_KEY);
  if (tenantSchema) {
    headers['X-Tenant-Schema'] = tenantSchema;
  }

  const response = await axios.post(
    `${API_URL}/auth/token/refresh/`,
    { refresh: refreshToken },
    { headers }
  );

  const { access, refresh } = response.data;
  localStorage.setItem('access_token', access);

  if (refresh) {
    localStorage.setItem('refresh_token', refresh);
  }

  return access;
};

api.interceptors.request.use(
  (config) => {
    const tenantSchema = localStorage.getItem(TENANT_SCHEMA_KEY);
    if (tenantSchema) {
      config.headers['X-Tenant-Schema'] = tenantSchema;
    }

    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('API request error:', error);
    return Promise.reject(
      new ApiError('Failed to send request. Please check your connection.')
    );
  }
);

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;

    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'] || 60;
      return Promise.reject(
        new ApiError(
          `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
          429
        )
      );
    }

    if (!error.response) {
      return Promise.reject(
        new ApiError(
          'Network error. Please check your connection and try again.',
          0
        )
      );
    }

    if (error.response?.status === 401 && originalRequest && !(originalRequest as { _retry?: boolean })._retry) {
      (originalRequest as { _retry?: boolean })._retry = true;

      try {
        if (!isRefreshing) {
          isRefreshing = true;
          refreshPromise = requestNewAccessToken().finally(() => {
            isRefreshing = false;
            refreshPromise = null;
          });
        }

        const access = await refreshPromise;
        originalRequest.headers.Authorization = `Bearer ${access}`;
        return api(originalRequest);
      } catch (refreshError: unknown) {
        const refreshStatus =
          axios.isAxiosError(refreshError) ? refreshError.response?.status : undefined;
        if (refreshStatus === 401 || refreshStatus === 403) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem(TENANT_SCHEMA_KEY);
          if (typeof window !== 'undefined') {
            window.location.href = '/auth/login';
          }
        }

        return Promise.reject(
          new ApiError('Your session has expired. Please log in again.', 401)
        );
      }
    }

    const errorData = error.response?.data as Record<string, unknown> | undefined;
    const detail = errorData?.detail;
    const message =
      (typeof detail === 'string' && detail) ||
      (Array.isArray(detail) && typeof detail[0] === 'string' && detail[0]) ||
      (typeof errorData?.error === 'string' && errorData.error) ||
      (typeof errorData?.message === 'string' && errorData.message) ||
      error.message ||
      'An unexpected error occurred';

    return Promise.reject(
      new ApiError(
        message,
        error.response?.status,
        errorData?.errors as Record<string, string[]> | undefined,
        errorData
      )
    );
  }
);

export default api;
