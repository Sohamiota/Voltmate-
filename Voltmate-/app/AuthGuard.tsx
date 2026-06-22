'use client'

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getStoredToken, clearToken, API_BASE } from '../src/api/client';

type Props = { children: React.ReactNode };

// ─── [H-4] Auth guard verifies the token server-side on every mount ───────────
// It does not just check for the presence of a localStorage value — it calls
// /auth/me with the stored token. An expired, revoked, or forged token returns
// 401 and the guard clears it and redirects to /login.
export default function AuthGuard({ children }: Props) {
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const publicPaths = ['/login', '/auth'];
    const isPublic    = publicPaths.some(p => pathname === p || pathname?.startsWith(p + '/'));

    if (isPublic) return;

    const token = getStoredToken();

    if (!token) {
      router.replace('/login');
      return;
    }

    // Validate the token against the backend
    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), 15_000);

    fetch(`${API_BASE}/auth/me`, {
      method:  'GET',
      headers: { Authorization: `Bearer ${token}` },
      signal:  ctrl.signal,
    })
      .then(res => {
        if (res.status === 401 || res.status === 403) {
          clearToken();
          router.replace('/login');
        }
        // Other errors (5xx, timeout) — keep the token; backend may be cold-starting
      })
      .catch(() => {
        // Network / timeout — do not clear token; user can retry once backend wakes up
      })
      .finally(() => clearTimeout(timeoutId));
  }, [pathname, router]);

  return <>{children}</>;
}
