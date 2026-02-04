import axios, { AxiosError } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// Custom error class for API errors
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public errors?: Record<string, string[]>,
    public response?: any
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
  timeout: 30000, // 30 second timeout
});

api.interceptors.request.use(
  (config) => {
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

    // Handle rate limiting
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'] || 60;
      return Promise.reject(
        new ApiError(
          `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
          429
        )
      );
    }

    // Handle network errors
    if (!error.response) {
      return Promise.reject(
        new ApiError(
          'Network error. Please check your connection and try again.',
          0
        )
      );
    }

    // Handle 401 Unauthorized
    if (error.response?.status === 401 && originalRequest && !(originalRequest as any)._retry) {
      (originalRequest as any)._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        const response = await axios.post(`${API_URL}/auth/token/refresh/`, {
          refresh: refreshToken,
        });

        const { access, refresh } = response.data;
        localStorage.setItem('access_token', access);
        localStorage.setItem('refresh_token', refresh);

        originalRequest.headers.Authorization = `Bearer ${access}`;
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/auth/login';
        return Promise.reject(
          new ApiError('Your session has expired. Please log in again.', 401)
        );
      }
    }

    // Handle other errors
    const errorData = error.response?.data as any;
    const message = errorData?.detail || 
                   errorData?.error || 
                   errorData?.message || 
                   error.message ||
                   'An unexpected error occurred';
    
    return Promise.reject(
      new ApiError(
        message,
        error.response?.status,
        errorData?.errors,
        errorData
      )
    );
  }
);

export default api;
