// Use environment-provided API base. In production (Vercel) set NEXT_PUBLIC_API_BASE.
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:8081/api/v1'
    : 'https://voltmate.onrender.com/api/v1');

// ─── [M-6] Single canonical key for the auth token ───────────────────────────
export const TOKEN_KEY = 'auth_token';

export function getStoredToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function storeToken(token: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
}

type RequestOptions = RequestInit & { token?: string };

// ─── [M-5] Safe error messages — never expose raw server response body ────────
async function safeErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    // Surface the server's own `error` field when present; fall back to generic.
    if (body?.error && typeof body.error === 'string') return body.error;
  } catch { /* ignore parse errors */ }
  // Status-code-based fallback — never exposes stack traces or SQL
  if (res.status === 401) return 'Session expired. Please log in again.';
  if (res.status === 403) return 'You do not have permission to perform this action.';
  if (res.status === 404) return 'Resource not found.';
  if (res.status >= 500)  return 'A server error occurred. Please try again later.';
  return `Request failed (${res.status})`;
}

async function request(path: string, opts: RequestOptions = {}) {
  const token = opts.token ?? getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  if (!res.ok) {
    const message = await safeErrorMessage(res);
    throw new Error(message);
  }
  return res.json();
}

export async function get(path: string, token?: string) {
  return request(path, { method: 'GET', token });
}

export async function post(path: string, body?: any, token?: string) {
  return request(path, {
    method: 'POST',
    body:   body ? JSON.stringify(body) : undefined,
    token,
  });
}

export async function patch(path: string, body?: any, token?: string) {
  return request(path, {
    method: 'PATCH',
    body:   body ? JSON.stringify(body) : undefined,
    token,
  });
}
