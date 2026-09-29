'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { manageContent } from './actions';

const FIELD_LABELS = {
  title: 'Title', organization: 'Organization/source', description: 'Description', source_url: 'Source link',
  start_date: 'Start date', end_date: 'End date', category: 'Category', priority: 'Priority',
  is_featured: 'Featured', featured_until: 'Featured until', expires_at: 'Expiry date',
};

function itemKey(row) { return `${row.content_type}:${row.id}`; }
function fieldLabel(field) { return FIELD_LABELS[field] || field.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function valueText(value) {
  if (value == null || value === '') return 'Not set';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  try { return JSON.stringify(value); } catch { return 'Structured value'; }
}
function changeEntries(audit) { return Object.entries(audit?.changes || {}).filter(([field]) => field !== 'record_snapshot'); }
function actorName(audit) { return audit?.actor?.full_name || audit?.actor?.email || 'Unknown editor'; }

function FullEditForm({ row, onSave }) {
  return <form className="content-edit-form content-edit-form-full" onSubmit={(event) => onSave(row, event)}>
    <label>Title<input name="title" defaultValue={row.title || ''} /></label>
    <label>Organization/source<input name="organization" defaultValue={row.org || row.source || ''} /></label>
    <label>Description/body<textarea name="description" rows="5" defaultValue={row.description || row.body || ''} /></label>
    {row.content_type === 'event' && <><label>Start date<input name="start_date" type="date" defaultValue={row.date || ''} /></label><label>End date<input name="end_date" type="date" min={row.date || undefined} defaultValue={row.end_date || ''} /></label></>}
    {row.content_type === 'announcement' && <><label>Category<select name="category" defaultValue={row.category || 'General'}>{['College','C.O.D.E.','Department','Academic','Event','Student Organization','General'].map(value=><option key={value}>{value}</option>)}</select></label><label>Official source URL<input name="source_url" type="url" defaultValue={row.source_url || ''} /></label><label>Priority<select name="priority" defaultValue={row.priority || 'standard'}><option value="standard">Standard</option><option value="leadership">University Leadership</option><option value="code">C.O.D.E. Leadership</option><option value="campus">Campus/Organization</option></select></label><label className="checkbox-label"><input type="checkbox" name="is_featured" defaultChecked={Boolean(row.is_featured)} /> Featured</label><label>Featured until<input name="featured_until" type="date" defaultValue={row.featured_until || ''} /></label><label>Expiry date<input name="expires_at" type="date" defaultValue={row.expires_at || ''} /></label></>}
    {row.content_type !== 'announcement' && <label>Source URL<input name="source_url" type="url" defaultValue={row.source_url || row.link || ''} /></label>}
    <button className="gold-button" type="submit">Save audited edit</button>
  </form>;
}

export default function ContentEditForms({ rows, auditEdits = [], embedded = false, startOpen = false }) {
  const [message, setMessage] = useState('');
  const [openChanges, setOpenChanges] = useState(null);
  const [openForm, setOpenForm] = useState(startOpen && rows[0] ? itemKey(rows[0]) : null);
  const router = useRouter();
  const latestByItem = useMemo(() => {
    const map = new Map();
    for (const audit of auditEdits) {
      const key = `${audit.content_type}:${audit.content_id}`;
      if (!map.has(key)) map.set(key, audit);
    }
    return map;
  }, [auditEdits]);

  async function save(row, event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const changes = { title: form.get('title'), organization: form.get('organization'), description: form.get('description'), source_url: form.get('source_url') || null, start_date: form.get('start_date') || null, end_date: form.get('end_date') || null, category: form.get('category') || null, priority: form.get('priority') || null, is_featured: form.get('is_featured') === 'on', featured_until: form.get('featured_until') || null, expires_at: form.get('expires_at') || null };
    setMessage(`Saving ${row.title}…`);
    const result = await manageContent(row.content_type, row.id, 'edit', changes);
    setMessage(result.ok ? 'Edit saved and audited.' : result.error || 'Edit failed.');
    if (result.ok) { setOpenForm(null); router.refresh(); }
  }

  return <section className={`content-edit-drawer${embedded ? ' is-embedded' : ''}`} aria-labelledby={embedded ? undefined : 'audited-edit-title'}>
    {!embedded && <div className="content-edit-heading"><div><div className="eyebrow">Audited editing</div><h2 id="audited-edit-title">Audited edit forms</h2><p>Review the latest recorded change before opening a full edit form.</p></div></div>}
    <p className="workspace-status" role="status" aria-live="polite">{message}</p>
    <div className="content-audit-list">{rows.filter(row => row.status !== 'deleted').map(row => {
      const key = itemKey(row);
      const audit = latestByItem.get(key);
      const entries = changeEntries(audit);
      const changesOpen = openChanges === key;
      const formOpen = openForm === key;
      return <article className="content-audit-card" key={key}>
        <div className="content-audit-summary"><div><h3>{row.title}</h3><p>{fieldLabel(row.content_type)} · {fieldLabel(row.status)}</p>{audit ? <p>Edited by {actorName(audit)} · {new Date(audit.created_at).toLocaleString()}</p> : <p>No audited field edits recorded yet.</p>}<strong>{entries.length} field{entries.length === 1 ? '' : 's'} changed</strong></div><div className="content-audit-actions">{entries.length > 0 && <button type="button" className="chip" aria-expanded={changesOpen} onClick={() => setOpenChanges(changesOpen ? null : key)}>{changesOpen ? 'Hide changes' : 'View changes'}</button>}<button type="button" className="outline-button" aria-expanded={formOpen} onClick={() => setOpenForm(formOpen ? null : key)}>{formOpen ? 'Close full edit form' : 'Open full edit form'}</button></div></div>
        {changesOpen && <div className="content-change-list">{entries.map(([field, change]) => {
          const structured = change && typeof change === 'object' && !Array.isArray(change) && ('from' in change || 'to' in change);
          return <section key={field}><h4>{fieldLabel(field)}</h4><dl><dt>Before</dt><dd>{structured ? valueText(change.from) : 'Not recorded in this legacy audit event'}</dd><dt>After</dt><dd>{valueText(structured ? change.to : change)}</dd></dl></section>;
        })}</div>}
        {formOpen && <FullEditForm row={row} onSave={save} />}
      </article>;
    })}</div>
  </section>;
}
