'use client';

import { useEffect, useState } from 'react';
import { createClient, isDemoMode } from '../lib/supabaseClient';
import {
  getAuthEmailErrorMessage,
  getAuthOtpErrorMessage,
  logAuthEmailError,
  logAuthOtpError,
} from '../lib/authErrors';

const PENDING_EMAIL_KEY = 'code-hub-pending-otp-email';
const OTP_LENGTH = 6;

export default function EmailSignInForm({ next }) {
  const [email,setEmail]=useState('');
  const [code,setCode]=useState('');
  const [message,setMessage]=useState('');
  const [messageTone,setMessageTone]=useState('');
  const [busy,setBusy]=useState(false);
  const [sent,setSent]=useState(false);
  const [cooldownUntil,setCooldownUntil]=useState(0);
  const [now,setNow]=useState(() => Date.now());
  const cooldownSeconds=Math.max(0,Math.ceil((cooldownUntil-now)/1000));

  useEffect(() => {
    const pendingEmail=sessionStorage.getItem(PENDING_EMAIL_KEY);
    if (pendingEmail) {
      setEmail(pendingEmail);
      setSent(true);
    }
  }, []);

  useEffect(() => {
    if (!cooldownUntil || cooldownSeconds <= 0) return undefined;
    const timer=setInterval(() => setNow(Date.now()),1000);
    return () => clearInterval(timer);
  }, [cooldownUntil,cooldownSeconds]);

  async function requestCode(targetEmail,{resend=false}={}){
    const normalized=String(targetEmail||'').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setMessage('Enter a valid email address.');
      setMessageTone('error');
      return;
    }
    if (cooldownSeconds > 0) {
      setMessage('A sign-in code was recently sent. Check your inbox or wait before requesting another.');
      setMessageTone('error');
      return;
    }
    setBusy(true); setMessage(''); setMessageTone('');
    if(isDemoMode){setMessage('Demo mode: email delivery is disabled. Configure Supabase Email Auth for a live sign-in code.');setMessageTone('info');setBusy(false);return;}
    const startedAt = Date.now();
    try {
      const supabase=createClient();
      // Preserve the existing admission rule: unknown emails may create an Auth
      // identity, while Hub roles and access remain governed by RBAC and RLS.
      const {error}=await supabase.auth.signInWithOtp({
        email:normalized,
        options:{shouldCreateUser:true},
      });
      const requestMs = Date.now() - startedAt;
      if (error) {
        logAuthEmailError(error, requestMs);
        setMessage(getAuthEmailErrorMessage(error));
        setMessageTone('error');
      } else {
        setEmail(normalized);
        setCode('');
        setSent(true);
        sessionStorage.setItem(PENDING_EMAIL_KEY,normalized);
        setCooldownUntil(Date.now()+60000);
        setNow(Date.now());
        if (resend) {
          setMessage('A new code was sent. Use the newest email you receive.');
          setMessageTone('info');
        }
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

  async function verifyCode(event){
    event.preventDefault();
    const token=code.replace(/\D/g,'');
    if (token.length !== OTP_LENGTH) {
      setMessage('Enter the complete 6-digit code from your email.');
      setMessageTone('error');
      return;
    }
    setBusy(true); setMessage(''); setMessageTone('');
    const startedAt=Date.now();
    try {
      const supabase=createClient();
      const {error}=await supabase.auth.verifyOtp({email,token,type:'email'});
      const requestMs=Date.now()-startedAt;
      if (error) {
        logAuthOtpError(error,requestMs);
        setMessage(getAuthOtpErrorMessage(error));
        setMessageTone('error');
        return;
      }
      sessionStorage.removeItem(PENDING_EMAIL_KEY);
      window.location.replace(next);
    } catch (error) {
      const requestMs=Date.now()-startedAt;
      logAuthOtpError(error,requestMs);
      setMessage(getAuthOtpErrorMessage(error));
      setMessageTone('error');
    } finally {
      setBusy(false);
    }
  }

  function changeEmail(){
    sessionStorage.removeItem(PENDING_EMAIL_KEY);
    setSent(false);
    setEmail('');
    setCode('');
    setMessage('');
    setMessageTone('');
  }

  if (sent) return <div className="auth-sent-state" role="region" aria-labelledby="otp-heading">
    <div className="auth-sent-icon" aria-hidden="true">✉</div>
    <h2 id="otp-heading">Enter your sign-in code</h2>
    <p>We sent a 6-digit code to <strong>{email}</strong>.</p>
    <p>PVAMU inboxes may take up to 3 minutes to receive it. The code expires after 10 minutes.</p>
    <form className="auth-email-form auth-otp-form" onSubmit={verifyCode}>
      <label><span>6-digit code</span><input required autoFocus type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={OTP_LENGTH} value={code} onChange={event=>{setCode(event.target.value.replace(/\D/g,'').slice(0,OTP_LENGTH));if(message){setMessage('');setMessageTone('');}}} aria-describedby="otp-help" /></label>
      <p id="otp-help" className="auth-otp-help">Enter the newest code if you requested more than one.</p>
      <button className="auth-primary-button" disabled={busy}>{busy?'Verifying…':'Verify code'}</button>
      {message&&<p className={'auth-form-message ' + messageTone} role="status" aria-live="polite">{message}</p>}
    </form>
    <div className="auth-sent-actions">
      <button type="button" className="auth-resend-button" disabled={busy || cooldownSeconds > 0} onClick={() => void requestCode(email,{resend:true})}>{cooldownSeconds > 0 ? 'Resend available in ' + cooldownSeconds + 's' : 'Resend code'}</button>
      <button type="button" className="auth-secondary-button" disabled={busy} onClick={changeEmail}>Change email</button>
    </div>
  </div>;

  return <form onSubmit={(event)=>{event.preventDefault();void requestCode(email);}} className="auth-email-form">
    <label><span>Email address</span><input required type="email" autoComplete="email" value={email} onChange={event=>{setEmail(event.target.value);if(message){setMessage('');setMessageTone('');}}} placeholder="you@pvamu.edu" /></label>
    <button className="auth-primary-button" disabled={busy || cooldownSeconds > 0}>{busy?'Sending…':cooldownSeconds > 0 ? 'Wait ' + cooldownSeconds + 's before requesting again':'Send code'}</button>
    {message&&<p className={'auth-form-message ' + messageTone} role="status" aria-live="polite">{message}</p>}
  </form>;
}
