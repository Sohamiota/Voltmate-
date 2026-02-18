// Use environment-provided API base. In production Vercel set NEXT_PUBLIC_API_BASE to your backend (e.g. https://api.voltwheelsind.com/api/v1)
// Fallback to localhost for local development, and to the production API as a last resort.
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:8081/api/v1'
    : 'https://api.voltwheelsind.com/api/v1');

type RequestOptions = RequestInit & { token?: string };

async function request(path: string, opts: RequestOptions = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string> || {}),
  };
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function get(path: string, token?: string) {
  return request(path, { method: "GET", token });
}

export async function post(path: string, body?: any, token?: string) {
  return request(path, { method: "POST", body: body ? JSON.stringify(body) : undefined, token });
}
