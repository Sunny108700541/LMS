export interface ApiErrorDetail {
  field?: string;
  rule?: string;
  message: string;
}

/** Mirrors the API's error envelope so components can show field-level messages. */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ApiErrorDetail[];

  constructor(status: number, code: string, message: string, details: ApiErrorDetail[] = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** FormData bypasses JSON encoding so the browser can set the multipart boundary. */
  formData?: FormData;
  signal?: AbortSignal;
}

let refreshInFlight: Promise<boolean> | null = null;

async function attemptRefresh(): Promise<boolean> {
  // Collapse parallel 401s into a single refresh call.
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

async function send<T>(path: string, options: RequestOptions, isRetry = false): Promise<T> {
  const init: RequestInit = {
    method: options.method ?? 'GET',
    // Tokens live in httpOnly cookies, so every call must carry credentials.
    credentials: 'include',
    ...(options.signal ? { signal: options.signal } : {}),
  };

  if (options.formData) {
    init.body = options.formData;
  } else if (options.body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${BASE_URL}${path}`, init);

  // An expired access token is recoverable: refresh once, then replay.
  if (response.status === 401 && !isRetry && !path.startsWith('/auth/')) {
    const refreshed = await attemptRefresh();
    if (refreshed) return send<T>(path, options, true);
  }

  const payload = (await response.json().catch(() => null)) as
    | { success: boolean; data?: T; meta?: unknown; error?: { code: string; message: string; details?: ApiErrorDetail[] } }
    | null;

  if (!response.ok || !payload?.success) {
    throw new ApiRequestError(
      response.status,
      payload?.error?.code ?? 'REQUEST_FAILED',
      payload?.error?.message ?? 'Something went wrong. Please try again.',
      payload?.error?.details ?? [],
    );
  }

  return (payload.meta ? ({ ...payload.data, meta: payload.meta } as T) : (payload.data as T));
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => send<T>(path, signal ? { signal } : {}),
  post: <T>(path: string, body?: unknown) => send<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => send<T>(path, { method: 'PATCH', body }),
  upload: <T>(path: string, formData: FormData) => send<T>(path, { method: 'POST', formData }),
};

/** Paginated endpoints return their meta alongside the array. */
export async function getList<T>(
  path: string,
  signal?: AbortSignal,
): Promise<{ items: T[]; meta: { page: number; limit: number; total: number; totalPages: number } }> {
  const response = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    ...(signal ? { signal } : {}),
  });

  if (response.status === 401) {
    const refreshed = await attemptRefresh();
    if (refreshed) return getList<T>(path, signal);
  }

  const payload = (await response.json().catch(() => null)) as {
    success: boolean;
    data?: T[];
    meta?: { page: number; limit: number; total: number; totalPages: number };
    error?: { code: string; message: string; details?: ApiErrorDetail[] };
  } | null;

  if (!response.ok || !payload?.success) {
    throw new ApiRequestError(
      response.status,
      payload?.error?.code ?? 'REQUEST_FAILED',
      payload?.error?.message ?? 'Something went wrong. Please try again.',
      payload?.error?.details ?? [],
    );
  }

  return {
    items: payload.data ?? [],
    meta: payload.meta ?? { page: 1, limit: 20, total: payload.data?.length ?? 0, totalPages: 1 },
  };
}
