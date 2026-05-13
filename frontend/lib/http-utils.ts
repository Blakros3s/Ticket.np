export type ListResponse<T> = T[] | { results?: T[] };

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export const normalizeListResponse = <T>(data: ListResponse<T>): T[] => {
  if (Array.isArray(data)) {
    return data;
  }

  if (data && typeof data === 'object' && Array.isArray(data.results)) {
    return data.results;
  }

  return [];
};

export const normalizePaginatedResponse = <T>(data: any): PaginatedResponse<T> => {
  if (data && typeof data === 'object' && Array.isArray(data.results)) {
    return {
      count: data.count || 0,
      next: data.next || null,
      previous: data.previous || null,
      results: data.results,
    };
  }

  const results = Array.isArray(data) ? data : [];
  return {
    count: results.length,
    next: null,
    previous: null,
    results: results,
  };
};

export const buildQueryString = (params: Record<string, string | number | undefined>): string => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      searchParams.append(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : '';
};
