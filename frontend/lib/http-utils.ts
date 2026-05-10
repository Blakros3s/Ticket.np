export type ListResponse<T> = T[] | { results?: T[] };

export const normalizeListResponse = <T>(data: ListResponse<T>): T[] => {
  if (Array.isArray(data)) {
    return data;
  }

  if (data && typeof data === 'object' && Array.isArray(data.results)) {
    return data.results;
  }

  return [];
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
