'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock } from 'lucide-react';
import { post } from '../../src/api/client';
import dynamic from 'next/dynamic';
const AuthTabs = dynamic(() => import('../../src/components/AuthTabs').then(m => m.Tabs), { ssr: false });

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirm, setConfirm] = useState('');
  const [role, setRole] = useState('');
  const [mode, setMode] = useState<'login' | 'register' | 'verify'>('login');
  const [otp, setOtp] = useState('');
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        const resp = await post('/auth/login', { email, password });
        if (resp && resp.token) {
          if (typeof window !== 'undefined') {
            localStorage.setItem('auth_token', resp.token);
          }
          router.push('/');
        } else {
          setError('Unexpected response from server');
        }
      } else {
        // register flow (client-side validation)
        if (password !== confirm) {
          setError('Passwords do not match');
          setLoading(false);
          return;
        }
        const payload: any = { name, email, password };
        if (role) payload.role = role;
        const resp = await post('/auth/register', payload);
        if (resp) {
          // switch to verify mode and show OTP input
          setRegisteredEmail(email);
          setMode('verify');
          setError('Registration submitted. Enter the OTP sent to your email.');
        }
      }
      
    } catch (err: any) {
      setError((err as any)?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Toggle dark class on html for Tailwind dark mode
    if (typeof document !== 'undefined') {
      if (theme === 'dark') document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  return (
    <div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-slate-900 to-black dark:from-slate-800 dark:via-slate-900 dark:to-black transition-colors duration-300'>
      <div className='max-w-md w-full bg-white/5 dark:bg-slate-900/70 backdrop-blur-md border border-white/10 dark:border-gray-800 rounded-2xl p-8 shadow-2xl'>
        <div className='flex items-start justify-between gap-4 mb-6'>
          <div>
            <div className='w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center text-white font-bold shadow-lg'>V</div>
          </div>
          <div className='flex-1 ml-3'>
            <h1 className='text-2xl font-semibold text-white mb-0'>Welcome to Voltmate</h1>
            <p className='text-sm text-gray-300'>Sign in or create an account</p>
          </div>
          <div className='flex items-center gap-2'>
            <button
              type='button'
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className='text-sm px-3 py-1 rounded-md bg-white/6 dark:bg-white/5 border border-white/6 hover:scale-105 active:scale-95 transition-transform duration-150'
            >
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>
        </div>

        <AuthTabs onModeChange={(m) => setMode(m)} />
        <form onSubmit={handleSubmit} className='space-y-4' id="auth-form">
          <label className='block'>
            <span className='text-sm text-gray-300'>Email</span>
            <div className='mt-1 relative rounded-md shadow-sm'>
              <span className='absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400'>
                <Mail size={16} />
              </span>
              <input
                type='email'
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className='w-full pl-10 pr-3 py-2 bg-white/6 dark:bg-slate-800 border border-white/6 dark:border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:shadow-lg transition-all duration-150'
                placeholder='you@company.com'
              />
            </div>
          </label>

          <label className='block'>
            <span className='text-sm text-gray-300'>Password</span>
            <div className='mt-1 relative rounded-md shadow-sm'>
              <span className='absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400'>
                <Lock size={16} />
              </span>
              <input
                type='password'
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className='w-full pl-10 pr-3 py-2 bg-white/6 dark:bg-slate-800 border border-white/6 dark:border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:shadow-lg transition-all duration-150'
                placeholder='••••••••'
              />
            </div>
          </label>
          {mode === 'register' && (
            <>
              <label className='block'>
                <span className='text-sm text-gray-300'>Full name</span>
                <input id='reg-name' value={name} onChange={(e) => setName(e.target.value)} className='mt-1 w-full pl-3 pr-3 py-2 rounded-md bg-white/6 dark:bg-slate-800 border border-white/6 dark:border-gray-700 text-white transition-all duration-150 focus:shadow-lg' placeholder='Full name' />
              </label>
              <label className='block mt-2'>
                <span className='text-sm text-gray-300'>Select role</span>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className='mt-1 w-full pl-3 pr-3 py-2 rounded-md bg-white/6 dark:bg-slate-800 border border-white/6 dark:border-gray-700 text-white transition-all duration-150 focus:shadow-lg'
                >
                  <option value=''>Select role</option>
                  <option value='admin'>Admin</option>
                  <option value='sales'>Sales</option>
                  <option value='service'>Service</option>
                </select>
              </label>
              <label className='block mt-2'>
                <span className='text-sm text-gray-300'>Confirm password</span>
                <input id='reg-confirm' type='password' value={confirm} onChange={(e) => setConfirm(e.target.value)} className='mt-1 w-full pl-3 pr-3 py-2 rounded-md bg-white/6 dark:bg-slate-800 border border-white/6 dark:border-gray-700 text-white transition-all duration-150 focus:shadow-lg' placeholder='Confirm password' />
              </label>
            </>
          )}

          {error && <div className='text-sm text-red-400'>{error}</div>}

          {mode === 'verify' && (
            <div className='mt-4'>
              <label className='block'>
                <span className='text-sm text-gray-300'>Enter OTP</span>
                <input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoFocus
                  className='mt-1 w-full pl-3 pr-3 py-3 rounded-md bg-white/6 dark:bg-slate-800 border border-white/6 dark:border-gray-700 text-white transition-all duration-150 focus:shadow-lg'
                  placeholder='6-digit code'
                />
              </label>
              <div className='mt-3 flex gap-2'>
                <button
                  type='button'
                  onClick={async () => {
                    setLoading(true);
                    setError(null);
                    try {
                      const r = await post('/auth/verify', { email: registeredEmail || email, otp });
                      if (r) {
                        setError('Email verified. Awaiting admin approval.');
                        setMode('login');
                      }
                    } catch (e: any) {
                      setError(e?.message || 'Verify failed');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className='py-2 px-4 bg-green-600 text-white rounded-md hover:scale-105 active:scale-95 transition-transform duration-150 min-h-[44px]'
                >
                  Verify OTP
                </button>
              </div>
            </div>
          )}

          {mode !== 'verify' && (
            <button
              type='submit'
              disabled={loading}
              className='w-full inline-flex justify-center items-center gap-2 py-3 px-4 bg-indigo-600 hover:scale-105 active:scale-95 text-white rounded-md font-medium disabled:opacity-60 transition-transform duration-150 shadow-md min-h-[44px]'
            >
              {loading ? (mode === 'login' ? 'Signing in...' : 'Registering...') : (mode === 'login' ? 'Sign in' : 'Create account')}
            </button>
          )}
        </form>

        <div className='mt-6 text-center text-sm text-gray-400'>
          Don't have an account? Register from the employee app or contact admin.
        </div>
      </div>
    </div>
  );
}
