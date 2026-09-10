'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { hardDeleteContent, manageContent, setHomeEvent, setHomeSpotlight } from './actions';

const TABS = [['all', 'All'], ['opportunity', 'Opportunities'], ['event', 'Events'], ['announcement', 'Announcements'], ['spotlight', 'Spotlight']];

export default function ContentManager({ rows, superAdmin = false }) {
  const router = useRouter();
  const [items, setItems] = useState(rows);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [message, setMessage] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteReason, setDeleteReason] = useState('');

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

  async function saveSpotlightRank(row, rank) { const result=await setHomeSpotlight(row.content_type,row.id,true,rank); setMessage(result.ok?'Spotlight order saved.':result.error||'Order could not be saved.'); if(result.ok)setItems(current=>current.map(item=>item.id===row.id&&item.content_type===row.content_type?{...item,spotlight_rank:Number(rank)}:item)); }
  async function homeEvent(row, visible=row.home_visible!==false, rank=row.home_rank||99) { const result=await setHomeEvent(row.id,visible,rank); setMessage(result.ok?'Home event display updated.':result.error||'Home event update failed.'); if(result.ok)setItems(current=>current.map(item=>item.id===row.id&&item.content_type==='event'?{...item,home_visible:visible,home_rank:visible?Number(rank):null}:item)); }
  async function confirmHardDelete(){if(!deleteTarget)return;const result=await hardDeleteContent(deleteTarget.content_type,deleteTarget.id,deleteReason);if(!result.ok){setMessage(result.error||'Permanent deletion failed.');return;}setItems(current=>current.filter(item=>!(item.id===deleteTarget.id&&item.content_type===deleteTarget.content_type)));setMessage('Content permanently deleted and audited.');setDeleteTarget(null);setDeleteReason('');if(!result.demo)router.refresh();}

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
        {row.status === 'published' && row.is_featured && <label className="content-order-control"><span>Spotlight order</span><input type="number" min="1" max="99" defaultValue={row.spotlight_rank||99}/><button className="chip" onClick={event=>saveSpotlightRank(row,event.currentTarget.previousElementSibling.value)}>Save</button></label>}
        {row.status === 'published' && row.content_type === 'event' && <><button className="chip" onClick={()=>homeEvent(row,row.home_visible===false)}>{row.home_visible===false?'Show on Home':'Hide from Home'}</button>{row.home_visible!==false&&<label className="content-order-control"><span>Home order</span><input type="number" min="1" max="99" defaultValue={row.home_rank||99}/><button className="chip" onClick={event=>homeEvent(row,true,event.currentTarget.previousElementSibling.value)}>Save</button></label>}</>}
        {row.status === 'published' && <button className="chip" onClick={() => act(row, 'unpublish')}>Unpublish content</button>}
        {['published', 'unpublished'].includes(row.status) && <button className="chip" onClick={() => act(row, 'archive')}>Archive</button>}
        {row.status !== 'deleted' && <button className="chip" onClick={() => act(row, 'soft_delete')}>Soft-delete</button>}
        {row.status === 'deleted' && <button className="gold-button" onClick={() => act(row, 'restore')}>Restore</button>}
        {superAdmin && row.status === 'deleted' && <button className="danger-button" onClick={()=>setDeleteTarget(row)}>Delete permanently</button>}
      </div>
    </article>)}</div> : <div className="workspace-empty">No content matches these filters.</div>}
    {deleteTarget&&<dialog open className="history-dialog" aria-labelledby="hard-delete-title"><div className="history-dialog-card"><button type="button" className="history-dialog-close" aria-label="Cancel permanent deletion" onClick={()=>setDeleteTarget(null)}>×</button><div className="eyebrow">Super Admin only</div><h2 id="hard-delete-title">Permanently delete this record?</h2><p><strong>{deleteTarget.title}</strong> cannot be restored. The audit event and deletion reason will remain.</p><label className="hard-delete-reason"><span>Required reason</span><textarea rows="4" minLength="10" value={deleteReason} onChange={event=>setDeleteReason(event.target.value)}/></label><div className="history-dialog-actions"><button className="chip" onClick={()=>setDeleteTarget(null)}>Cancel</button><button className="danger-button" disabled={deleteReason.trim().length<10} onClick={confirmHardDelete}>Delete permanently</button></div></div></dialog>}
  </section>;
}
