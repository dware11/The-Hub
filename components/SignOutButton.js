'use client';

import { useState, useTransition } from 'react';
import { createClient } from '../lib/supabaseClient';

export default function SignOutButton() {
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();

  function signOut() {
    startTransition(async () => {
      setMessage('Signing out…');
      sessionStorage.setItem('code-signout-in-progress', 'true');
      try {
        const supabase = createClient();
        if (supabase) await supabase.auth.signOut();
        await fetch('/auth/signout', { method: 'POST', cache: 'no-store', credentials: 'same-origin' });
      } finally {
        const marker = String(Date.now());
        localStorage.setItem('code-hub-signed-out', marker);
        if (typeof BroadcastChannel !== 'undefined') {
          const channel = new BroadcastChannel('code-hub-auth');
          channel.postMessage('signed-out');
          channel.close();
        }
        window.location.replace('/');
      }
    });
  }

  return <>
    <button type="button" disabled={pending} onClick={signOut}>{pending ? 'Signing out…' : 'Sign out'}</button>
    <span className="sr-only" role="status" aria-live="polite">{message}</span>
  </>;
}
