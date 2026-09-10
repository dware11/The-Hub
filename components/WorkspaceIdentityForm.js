'use client';

import { useState } from 'react';
import { updateDisplayName } from '../app/admin/profile/actions';

export default function WorkspaceIdentityForm({ email }) {
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    const result = await updateDisplayName(name);
    setMessage(result.ok ? 'Name saved. Refreshing workspace…' : result.error || 'Name could not be saved.');
    setBusy(false);
    if (result.ok && !result.demo) window.location.reload();
  }
  return <form className="workspace-name-form" onSubmit={submit}>
    <strong>Finish your workspace identity</strong>
    <small>{email}</small>
    <label><span>Full name</span><input required minLength={2} maxLength={120} autoComplete="name" value={name} onChange={event => setName(event.target.value)} /></label>
    <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save name'}</button>
    {message && <small role="status" aria-live="polite">{message}</small>}
  </form>;
}
