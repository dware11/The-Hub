'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { manageContent, setHomeSpotlight } from './actions';

const TABS = [['all', 'All'], ['opportunity', 'Opportunities'], ['event', 'Events'], ['announcement', 'Announcements'], ['spotlight', 'Spotlight']];

export default function ContentManager({ rows }) {
  const router = useRouter();
  const [items, setItems] = useState(rows);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => setItems(rows), [rows]);

  const filtered = useMemo(() => items.filter(row =>
    (tab === 'all' || tab === 'spotlight' ? (tab === 'all' || row.is_featured) : row.content_type === tab)
    && (!status || row.status === status)
    && (!search || `${row.title} ${row.org || row.source || ''}`.toLowerCase().includes(search.toLowerCase()))
  ), [items, tab, status, search]);

  async function act(row, action) {
    setMessage(`${action} ${row.title}…`);
    const result = await manageContent(row.content_type, row.id, action);
    if (!result.ok) { setMessage(result.error || 'Update failed.'); return; }
    setItems(current => current.map(item => item.id === row.id && item.content_type === row.content_type ? {
      ...item,
      status: action === 'unpublish' ? 'unpublished' : action === 'archive' ? 'archived' : action === 'soft_delete' ? 'deleted' : action === 'restore' ? 'published' : item.status,
    } : item));
    setMessage('Content action completed and audited.');
    if (!result.demo) router.refresh();
  }

  async function spotlight(row) {
    const next = !row.is_featured;
    setMessage(`${next ? 'Adding to' : 'Removing from'} Home Spotlight…`);
    const result = await setHomeSpotlight(row.content_type, row.id, next, row.spotlight_rank || 99);
    if (!result.ok) { setMessage(result.error || 'Spotlight update failed.'); return; }
    setItems(current => current.map(item => item.id === row.id && item.content_type === row.content_type ? {
      ...item,
      is_featured: next,
      spotlight_rank: next ? (row.spotlight_rank || 99) : null,
    } : item));
    setMessage(next ? 'Added to Home Spotlight.' : 'Removed from Home Spotlight.');
    if (!result.demo) router.refresh();
  }

  return <section className="content-manager" aria-label="Content management">
    <div className="content-manager-controls">
      <label><span>Search content</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Title or organization" /></label>
      <label><span>Status</span><select value={status} onChange={event => setStatus(event.target.value)}><option value="">All statuses</option><option value="published">Published</option><option value="unpublished">Unpublished</option><option value="archived">Archived</option><option value="deleted">Deleted</option></select></label>
    </div>
    <div className="content-tabs" role="tablist" aria-label="Content type">{TABS.map(([value, label]) => <button type="button" role="tab" key={value} aria-selected={tab === value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>{label} <span>{value === 'all' ? items.length : value === 'spotlight' ? items.filter(item => item.is_featured).length : items.filter(item => item.content_type === value).length}</span></button>)}</div>
    <p className="workspace-status" role="status" aria-live="polite">{message || `${filtered.length} records shown.`}</p>
    {filtered.length ? <div className="content-table" role="region" aria-label="Managed content records">{filtered.map(row => <article className="content-row" key={`${row.content_type}-${row.id}`}>
      <div><div className="eyebrow">{row.content_type} · {row.status}{row.is_featured ? ' · Home Spotlight' : ''}</div><h2>{row.title}</h2><p>{row.org || row.source || 'Organization not provided'}</p><small>{row.deadline ? `Deadline ${new Date(row.deadline + 'T12:00:00').toLocaleDateString()}` : row.date ? `Event ${new Date(row.date + 'T12:00:00').toLocaleDateString()}` : 'No date recorded'}</small></div>
      <div className="content-row-actions">
        {row.status === 'published' && <button className={row.is_featured ? 'gold-button' : 'chip'} onClick={() => spotlight(row)}>{row.is_featured ? 'Remove from Spotlight' : 'Set as Spotlight'}</button>}
        {row.status === 'published' && <button className="chip" onClick={() => act(row, 'unpublish')}>Unpublish content</button>}
        {['published', 'unpublished'].includes(row.status) && <button className="chip" onClick={() => act(row, 'archive')}>Archive</button>}
        {row.status !== 'deleted' && <button className="chip" onClick={() => act(row, 'soft_delete')}>Soft-delete</button>}
        {row.status === 'deleted' && <button className="gold-button" onClick={() => act(row, 'restore')}>Restore</button>}
      </div>
    </article>)}</div> : <div className="workspace-empty">No content matches these filters.</div>}
  </section>;
}
