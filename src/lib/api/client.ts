export interface APIErrorResponse {
  error: {
    code: string;
    message: string;
    request_id?: string;
    details?: Record<string, any>;
  };
}

export class APIClientError extends Error {
  code: string;
  requestId?: string;
  details?: Record<string, any>;
  statusCode: number;

  constructor(message: string, code: string = 'API_ERROR', statusCode: number = 400, requestId?: string, details?: Record<string, any>) {
    super(message);
    this.name = 'APIClientError';
    this.code = code;
    this.statusCode = statusCode;
    this.requestId = requestId;
    this.details = details;
  }
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
  const url = `${baseUrl}${endpoint}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    const requestId = res.headers.get('x-request-id') || undefined;

    if (!res.ok) {
      let errorData: APIErrorResponse | null = null;
      try {
        errorData = await res.json();
      } catch (e) {
        // Fallback if not json
      }

      const code = errorData?.error?.code || `HTTP_${res.status}`;
      const message = errorData?.error?.message || `Request failed with status ${res.status}`;
      throw new APIClientError(message, code, res.status, requestId, errorData?.error?.details);
    }

    return (await res.json()) as T;
  } catch (err: any) {
    if (err instanceof APIClientError) {
      throw err;
    }
    throw new APIClientError(err?.message || 'Network connection failed.', 'NETWORK_ERROR', 0);
  }
}
