'use client';

import { useEffect, useState } from 'react';
import { createClient, isDemoMode } from '../lib/supabaseClient';
import { buildEmailRedirectUrl } from '../lib/authRedirects';
import { getAuthEmailErrorMessage, logAuthEmailError } from '../lib/authErrors';

export default function EmailSignInForm({ next }) {
  const [email,setEmail]=useState('');
  const [message,setMessage]=useState('');
  const [messageTone,setMessageTone]=useState('');
  const [busy,setBusy]=useState(false);
  const [sent,setSent]=useState(false);
  const [cooldownUntil,setCooldownUntil]=useState(0);
  const [now,setNow]=useState(() => Date.now());
  const cooldownSeconds=Math.max(0,Math.ceil((cooldownUntil-now)/1000));

  useEffect(() => {
    if (!cooldownUntil || cooldownSeconds <= 0) return undefined;
    const timer=setInterval(() => setNow(Date.now()),1000);
    return () => clearInterval(timer);
  }, [cooldownUntil,cooldownSeconds]);

  async function requestLink(targetEmail){
    const normalized=String(targetEmail||'').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setMessage('Enter a valid email address.');
      setMessageTone('error');
      return;
    }
    if (cooldownSeconds > 0) {
      setMessage('A sign-in link was recently sent. Check your inbox or wait before requesting another.');
      setMessageTone('error');
      return;
    }
    setBusy(true); setMessage(''); setMessageTone('');
    if(isDemoMode){setMessage('Demo mode: email delivery is disabled. Configure Supabase Email Auth for a live sign-in link.');setMessageTone('info');setBusy(false);return;}
    const startedAt = Date.now();
    try {
      const supabase=createClient();
      const {error}=await supabase.auth.signInWithOtp({email:normalized,options:{emailRedirectTo:buildEmailRedirectUrl(window.location.origin,next)}});
      const requestMs = Date.now() - startedAt;
      if (error) {
        logAuthEmailError(error, requestMs);
        setMessage(getAuthEmailErrorMessage(error));
        setMessageTone('error');
      } else {
        setSent(true);
        setCooldownUntil(Date.now()+60000);
        setNow(Date.now());
      }
    } catch (error) {
      const requestMs = Date.now() - startedAt;
      logAuthEmailError(error, requestMs);
      setMessage(getAuthEmailErrorMessage(error));
      setMessageTone('error');
    } finally {
      setBusy(false);
    }
  }
  function submit(event){
    event.preventDefault();
    void requestLink(email);
  }
  if (sent) return <div className="auth-sent-state" role="status" aria-live="polite">
    <div className="auth-sent-icon" aria-hidden="true">✓</div>
    <h2>Check your email</h2>
    <p>We sent a secure sign-in link to your email address.</p>
    <p>Open the link to continue. You’ll return to the page you requested.</p>
    <div className="auth-sent-actions">
      <button type="button" className="auth-secondary-button" onClick={() => { setSent(false); setEmail(''); setMessage(''); setMessageTone(''); }}>Change email</button>
      <button type="button" className="auth-resend-button" disabled={busy || cooldownSeconds > 0} onClick={() => void requestLink(email)}>{cooldownSeconds > 0 ? 'Resend available in ' + cooldownSeconds + 's' : 'Resend sign-in link'}</button>
    </div>
  </div>;
  return <form onSubmit={submit} className="auth-email-form">
    <label><span>Email address</span><input required type="email" autoComplete="email" value={email} onChange={event=>{setEmail(event.target.value);if(message){setMessage('');setMessageTone('');}}} placeholder="you@pvamu.edu" /></label>
    <button className="auth-primary-button" disabled={busy || cooldownSeconds > 0}>{busy?'Sending…':cooldownSeconds > 0 ? 'Wait ' + cooldownSeconds + 's before requesting again':'Email me a sign-in link'}</button>
    {message&&<p className={'auth-form-message ' + messageTone} role="status" aria-live="polite">{message}</p>}
  </form>;
}
