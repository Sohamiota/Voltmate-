'use client'

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

type Props = { children: React.ReactNode };

export default function AuthGuard({ children }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = typeof window !== 'undefined' && (localStorage.getItem('auth_token') || localStorage.getItem('token'));
    // Allow access to public routes
    if (!token && pathname !== '/login' && !pathname?.startsWith('/api')) {
      router.replace('/login');
    }
    // If already logged in and on login page, send to root
    if (token && (pathname === '/login' || pathname === '/')) {
      // keep at root if already at root; otherwise ensure logged-in users don't stay on login
      if (pathname === '/login') router.replace('/');
    }
  }, [pathname, router]);

  return <>{children}</>;
}

