import axios, { AxiosError } from 'axios';
import { ApiError, isAccessTokenExpired } from './api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
export const PLATFORM_ACCESS_KEY = 'platform_access_token';
export const PLATFORM_REFRESH_KEY = 'platform_refresh_token';
const PLATFORM_REFRESH_LOCK_KEY = 'ticketnp_platform_refresh_lock';
const REFRESH_LOCK_TTL_MS = 15000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquirePlatformRefreshLock(): Promise<void> {
  const deadline = Date.now() + REFRESH_LOCK_TTL_MS;
  while (Date.now() < deadline) {
    const raw = localStorage.getItem(PLATFORM_REFRESH_LOCK_KEY);
    if (!raw) {
      localStorage.setItem(PLATFORM_REFRESH_LOCK_KEY, String(Date.now()));
      return;
    }
    const started = Number(raw);
    if (Number.isNaN(started) || Date.now() - started > REFRESH_LOCK_TTL_MS) {
      localStorage.setItem(PLATFORM_REFRESH_LOCK_KEY, String(Date.now()));
      return;
    }
    await sleep(200);
  }
  throw new Error('Platform token refresh lock timeout');
}

function releasePlatformRefreshLock(): void {
  localStorage.removeItem(PLATFORM_REFRESH_LOCK_KEY);
}

export function clearPlatformAuthStorage(): void {
  localStorage.removeItem(PLATFORM_ACCESS_KEY);
  localStorage.removeItem(PLATFORM_REFRESH_KEY);
}

export function hasStoredPlatformAuthSession(): boolean {
  return Boolean(
    localStorage.getItem(PLATFORM_ACCESS_KEY) || localStorage.getItem(PLATFORM_REFRESH_KEY),
  );
}

export function extractPlatformApiMessage(errorData: Record<string, unknown> | undefined, fallback: string): string {
  if (!errorData) return fallback;

  const detail = errorData.detail;
  if (typeof detail === 'string' && detail) return detail;
  if (Array.isArray(detail) && typeof detail[0] === 'string') return detail[0];

  for (const key of ['password', 'slug', 'non_field_errors']) {
    const value = errorData[key];
    if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
    if (typeof value === 'string' && value) return value;
  }

  if (typeof errorData.error === 'string' && errorData.error) return errorData.error;
  if (typeof errorData.message === 'string' && errorData.message) return errorData.message;

  return fallback;
}

const platformApi = axios.create({
  baseURL: `${API_URL}/server`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

let isRefreshing = false;
let refreshPromise: Promise<string> | null = null;

const requestNewPlatformAccessToken = async (): Promise<string> => {
  const refreshToken = localStorage.getItem(PLATFORM_REFRESH_KEY);
  if (!refreshToken) {
    throw new Error('No platform refresh token');
  }

  const response = await axios.post(`${API_URL}/server/auth/token/refresh/`, {
    refresh: refreshToken,
  });

  const { access, refresh } = response.data;
  localStorage.setItem(PLATFORM_ACCESS_KEY, access);
  if (refresh) {
    localStorage.setItem(PLATFORM_REFRESH_KEY, refresh);
  }

  return access;
};

export async function ensureValidPlatformAccessToken(): Promise<boolean> {
  const access = localStorage.getItem(PLATFORM_ACCESS_KEY);
  const refresh = localStorage.getItem(PLATFORM_REFRESH_KEY);
  if (!access && !refresh) {
    return false;
  }
  if (access && !isAccessTokenExpired(access)) {
    return true;
  }
  if (!refresh) {
    return false;
  }

  await acquirePlatformRefreshLock();
  try {
    const latestAccess = localStorage.getItem(PLATFORM_ACCESS_KEY);
    if (latestAccess && !isAccessTokenExpired(latestAccess)) {
      return true;
    }
    await requestNewPlatformAccessToken();
    return true;
  } catch (error) {
    if (axios.isAxiosError(error) && !error.response) {
      throw error;
    }
    return false;
  } finally {
    releasePlatformRefreshLock();
  }
}

platformApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(PLATFORM_ACCESS_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  () => Promise.reject(new ApiError('Failed to send request. Please check your connection.'))
);

platformApi.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;

    if (!error.response) {
      return Promise.reject(
        new ApiError('Network error. Please check your connection and try again.', 0)
      );
    }

    if (error.response.status === 401 && originalRequest && !(originalRequest as { _retry?: boolean })._retry) {
      (originalRequest as { _retry?: boolean })._retry = true;

      try {
        if (!isRefreshing) {
          isRefreshing = true;
          refreshPromise = ensureValidPlatformAccessToken()
            .then((ok) => {
              if (!ok) {
                throw new Error('No valid platform token');
              }
              const token = localStorage.getItem(PLATFORM_ACCESS_KEY);
              if (!token) {
                throw new Error('No platform access token');
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
        return platformApi(originalRequest);
      } catch {
        clearPlatformAuthStorage();
        if (typeof window !== 'undefined') {
          window.location.href = '/console';
        }
        return Promise.reject(new ApiError('Your session has expired. Please log in again.', 401));
      }
    }

    const errorData = error.response.data as Record<string, unknown> | undefined;
    const message = extractPlatformApiMessage(errorData, error.message || 'An unexpected error occurred');

    return Promise.reject(
      new ApiError(message, error.response.status, errorData?.errors as Record<string, string[]> | undefined, errorData)
    );
  }
);

export default platformApi;
