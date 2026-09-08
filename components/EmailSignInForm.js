'use client';

import { useState } from 'react';
import { createClient, isDemoMode } from '../lib/supabaseClient';

export default function EmailSignInForm({ next }) {
  const [email,setEmail]=useState('');
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  async function submit(event){
    event.preventDefault(); setBusy(true); setMessage('');
    if(isDemoMode){setMessage('Demo mode: email delivery is disabled. Configure Supabase Email Auth for a live sign-in link.');setBusy(false);return;}
    const supabase=createClient();
    const {error}=await supabase.auth.signInWithOtp({email:email.trim().toLowerCase(),options:{emailRedirectTo:`${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`}});
    setMessage(error?'The sign-in email could not be sent. Please verify the address and try again.':'Check your email for a secure sign-in link. You will return to the page you requested.');
    setBusy(false);
  }
  return <form onSubmit={submit} className="auth-email-form">
    <label><span>Email address</span><input required type="email" autoComplete="email" value={email} onChange={event=>setEmail(event.target.value)} placeholder="you@pvamu.edu" /></label>
    <button className="gold-button" disabled={busy}>{busy?'Sending…':'Email me a sign-in link'}</button>
    {message&&<p role="status" aria-live="polite">{message}</p>}
  </form>;
}
