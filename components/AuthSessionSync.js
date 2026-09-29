'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, isDemoMode } from '../lib/supabaseClient';

const SIGN_OUT_KEY = 'code-hub-signed-out';

export default function AuthSessionSync() {
  const router = useRouter();

  useEffect(() => {
    if (isDemoMode) return undefined;
    const supabase = createClient();
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('code-hub-auth');
    const moveToSignedOutState = () => window.location.replace('/');
    const refreshServerState = () => router.refresh();
    const onStorage = (event) => {
      if (event.key === SIGN_OUT_KEY && event.newValue) moveToSignedOutState();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshServerState();
    };
    const onPageShow = (event) => {
      if (event.persisted) refreshServerState();
    };

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && sessionStorage.getItem('code-signout-in-progress') !== 'true') {
        moveToSignedOutState();
      }
    });
    if (channel) channel.onmessage = (event) => {
      if (event.data === 'signed-out') moveToSignedOutState();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      listener?.subscription?.unsubscribe();
      channel?.close();
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [router]);

  return null;
}
