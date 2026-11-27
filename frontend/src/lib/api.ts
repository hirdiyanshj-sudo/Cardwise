const API_BASE = import.meta.env.VITE_API_URL || '/api';

let cachedCsrfToken = '';

export function setCachedCsrfToken(token: string) {
  if (token) cachedCsrfToken = token;
}

export function getCsrfToken(): string {
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith('cw_csrf_token='));
  if (match) {
    return decodeURIComponent(match.split('=')[1] || '');
  }
  return cachedCsrfToken;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

let refreshPromise: Promise<boolean> | null = null;

async function attemptTokenRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': getCsrfToken(),
          },
        });
        if (!res.ok) return false;
        const data = await res.json();
        if (data?.csrfToken) setCachedCsrfToken(data.csrfToken);
        return true;
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

export async function apiRequest<T = any>(
  path: string,
  options: RequestInit = {},
  allowRetry = true
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (method !== 'GET' && method !== 'HEAD') {
    const csrf = getCsrfToken();
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });

  if (
    res.status === 401 &&
    allowRetry &&
    !path.startsWith('/auth/login') &&
    !path.startsWith('/auth/register') &&
    !path.startsWith('/auth/refresh') &&
    !path.startsWith('/auth/mfa/')
  ) {
    const refreshed = await attemptTokenRefresh();
    if (refreshed) {
      return apiRequest<T>(path, options, false);
    }
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const errData = await res.json();
      if (errData?.error) message = errData.error;
    } catch {
      // ignore json parse failure
    }
    throw new ApiError(message, res.status);
  }

  const data = (await res.json()) as any;
  if (data?.csrfToken) setCachedCsrfToken(data.csrfToken);
  return data as T;
}

export async function downloadProtectedFile(path: string, filename: string): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
  });
  if (res.status === 401) {
    const refreshed = await attemptTokenRefresh();
    if (refreshed) return downloadProtectedFile(path, filename);
  }
  if (!res.ok) {
    throw new ApiError('Failed to generate download', res.status);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
