'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

function BrandHeader() {
  return (
    <header className="auth-confirm-brand" aria-label="C.O.D.E. Engineering Hub">
      <strong>C.O.D.E.</strong>
      <span>Engineering Hub</span>
      <i aria-hidden="true" />
    </header>
  );
}

function StateIcon({ state }) {
  if (state === 'loading') return <span className="auth-confirm-spinner" aria-hidden="true" />;

  if (state === 'success') {
    return (
      <span className="auth-confirm-icon auth-confirm-icon-success" aria-hidden="true">
        <svg viewBox="0 0 48 48"><path d="m14 25 7 7 14-16" /></svg>
      </span>
    );
  }

  return (
    <span className="auth-confirm-icon auth-confirm-icon-error" aria-hidden="true">
      <svg viewBox="0 0 48 48"><path d="m16 16 16 16M32 16 16 32" /></svg>
    </span>
  );
}

function InstitutionFooter() {
  return (
    <footer className="auth-confirm-footer">
      <span>Prairie View A&amp;M University</span>
      <span>Council of Distinguished Engineers</span>
      <i aria-hidden="true" />
    </footer>
  );
}

export default function AuthConfirmation({ tokenHash, type, next }) {
  const [state, setState] = useState(tokenHash ? 'loading' : 'error');
  const titleRef = useRef(null);

  useEffect(() => {
    if (!tokenHash) return undefined;

    const controller = new AbortController();
    let redirectTimer;

    async function confirm() {
      try {
        const response = await fetch('/auth/confirm/verify', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token_hash: tokenHash, type, next }),
          signal: controller.signal,
        });
        const result = await response.json();

        if (!response.ok || !result?.ok || typeof result?.next !== 'string') {
          setState('error');
          return;
        }

        setState('success');
        redirectTimer = window.setTimeout(() => window.location.replace(result.next), 650);
      } catch (error) {
        if (error?.name !== 'AbortError') setState('error');
      }
    }

    confirm();
    return () => {
      controller.abort();
      if (redirectTimer) window.clearTimeout(redirectTimer);
    };
  }, [next, tokenHash, type]);

  useEffect(() => {
    if (state !== 'loading') titleRef.current?.focus();
  }, [state]);

  const title = state === 'loading'
    ? 'Signing you in...'
    : state === 'success'
      ? "You're signed in."
      : 'This sign-in link is no longer valid.';

  return (
    <section className="auth-confirm-card" aria-labelledby="auth-confirm-title">
      <BrandHeader />
      <div
        className={`auth-confirm-state auth-confirm-state-${state}`}
        role={state === 'error' ? 'alert' : 'status'}
        aria-live={state === 'error' ? 'assertive' : 'polite'}
        aria-atomic="true"
      >
        <StateIcon state={state} />
        <h1 id="auth-confirm-title" ref={titleRef} tabIndex="-1">{title}</h1>
        {state === 'loading' && <p>Verifying your secure sign-in link.</p>}
        {state === 'success' && <p>Taking you to the Engineering Hub...</p>}
        {state === 'error' && (
          <p>Magic links can expire or only be used once.<br />Please request a new sign-in link to continue.</p>
        )}
      </div>

      <div className="auth-confirm-actions">
        {state === 'error' && (
          <Link className="auth-confirm-button auth-confirm-button-primary" href="/auth/signin">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 6.5 12 13l9-6.5M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" /></svg>
            Send a New Sign-in Link
          </Link>
        )}
        {state !== 'success' && (
          <Link className="auth-confirm-button auth-confirm-button-secondary" href="/">
            <span aria-hidden="true">←</span> Back to Hub
          </Link>
        )}
      </div>
      <InstitutionFooter />
    </section>
  );
}
