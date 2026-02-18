import React, { useState } from 'react';

export function Tabs({ onModeChange }: { onModeChange?: (mode: 'login' | 'register') => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  function select(m: 'login' | 'register') {
    setMode(m);
    onModeChange?.(m);
  }
  // expose a small script to show/hide register fields and set form data-mode
  React.useEffect(() => {
    const form = document.getElementById('auth-form') as HTMLFormElement | null;
    const regFields = document.getElementById('register-fields');
    if (form && regFields) {
      if (mode === 'register') {
        regFields.style.display = '';
        form.dataset.mode = 'register';
      } else {
        regFields.style.display = 'none';
        form.dataset.mode = 'login';
      }
    }
  }, [mode]);
  return (
    <div className="mb-4 flex gap-2 bg-white/3 p-1 rounded-full">
      <button
        onClick={() => select('login')}
        className={`flex-1 py-2 rounded-full text-sm font-medium ${mode === 'login' ? 'bg-white/10' : 'bg-transparent'}`}
        type="button"
      >
        Sign in
      </button>
      <button
        onClick={() => select('register')}
        className={`flex-1 py-2 rounded-full text-sm font-medium ${mode === 'register' ? 'bg-white/10' : 'bg-transparent'}`}
        type="button"
      >
        Create account
      </button>
    </div>
  );
}

