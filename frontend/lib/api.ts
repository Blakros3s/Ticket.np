import axios, { AxiosError } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
export const TENANT_SCHEMA_KEY = 'tenant_schema';
const REFRESH_LOCK_KEY = 'ticketnp_tenant_refresh_lock';
const REFRESH_LOCK_TTL_MS = 15000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - base64.length % 4) % 4), '=');
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function isAccessTokenExpired(token: string, skewSeconds = 30): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') {
    return false;
  }
  return payload.exp * 1000 <= Date.now() + skewSeconds * 1000;
}

async function acquireRefreshLock(): Promise<void> {
  const deadline = Date.now() + REFRESH_LOCK_TTL_MS;
  while (Date.now() < deadline) {
    const raw = localStorage.getItem(REFRESH_LOCK_KEY);
    if (!raw) {
      localStorage.setItem(REFRESH_LOCK_KEY, String(Date.now()));
      return;
    }
    const started = Number(raw);
    if (Number.isNaN(started) || Date.now() - started > REFRESH_LOCK_TTL_MS) {
      localStorage.setItem(REFRESH_LOCK_KEY, String(Date.now()));
      return;
    }
    await sleep(200);
  }
  throw new Error('Token refresh lock timeout');
}

function releaseRefreshLock(): void {
  localStorage.removeItem(REFRESH_LOCK_KEY);
}

export function clearAuthStorage(): void {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem(TENANT_SCHEMA_KEY);
}

export function hasStoredAuthSession(): boolean {
  return Boolean(
    localStorage.getItem('access_token') || localStorage.getItem('refresh_token'),
  );
}

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

/** Refresh access token when expired; coordinates across tabs via localStorage lock. */
export async function ensureValidAccessToken(): Promise<boolean> {
  const access = localStorage.getItem('access_token');
  const refresh = localStorage.getItem('refresh_token');
  if (!access && !refresh) {
    return false;
  }
  if (access && !isAccessTokenExpired(access)) {
    return true;
  }
  if (!refresh) {
    return false;
  }

  await acquireRefreshLock();
  try {
    const latestAccess = localStorage.getItem('access_token');
    if (latestAccess && !isAccessTokenExpired(latestAccess)) {
      return true;
    }
    await requestNewAccessToken();
    return true;
  } catch (error) {
    if (axios.isAxiosError(error) && !error.response) {
      throw error;
    }
    return false;
  } finally {
    releaseRefreshLock();
  }
}

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
          refreshPromise = ensureValidAccessToken()
            .then((ok) => {
              if (!ok) {
                throw new Error('No valid token');
              }
              const token = localStorage.getItem('access_token');
              if (!token) {
                throw new Error('No access token');
              }
              return token;
            })
            .finally(() => {
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
          clearAuthStorage();
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
