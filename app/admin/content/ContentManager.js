'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { confirmOpportunityAvailability, hardDeleteContent, manageContent, setHomeAnnouncement, setHomeSpotlight } from './actions';
import ContentEditForms from './ContentEditForms';
import { deadlineLabel } from '../../../lib/opportunityOptions';

const BASE_TABS = [['all', 'All'], ['opportunity', 'Opportunities'], ['event', 'Events'], ['announcement', 'Announcements'], ['spotlight', 'Spotlight']];
const STATUS_OPTIONS = [
  ['active', 'Active / current workflow'],
  ['', 'All statuses'],
  ['pending', 'Pending Review'],
  ['resubmitted', 'Pending Review · Resubmitted'],
  ['needs_correction', 'Needs Correction'],
  ['published', 'Published'],
  ['rejected', 'Rejected'],
  ['unpublished', 'Unpublished'],
  ['archived', 'Archived'],
  ['deleted', 'In trash'],
  ['expired_before_review', 'Expired Before Review'],
];
const EDITABLE_STATUSES = new Set(['published', 'unpublished', 'archived']);

function statusLabel(value) {
  return STATUS_OPTIONS.find(([status]) => status === value)?.[1] || String(value || 'Unknown').replaceAll('_', ' ');
}

export default function ContentManager({ rows, auditEdits = [], superAdmin = false, availabilityAccess = false }) {
  const router = useRouter();
  const [items, setItems] = useState(rows);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('active');
  const [sort, setSort] = useState('upcoming');
  const [message, setMessage] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [actionTarget, setActionTarget] = useState(null);
  const [editorTarget, setEditorTarget] = useState(null);
  const tabs = availabilityAccess ? [...BASE_TABS, ['availability', 'Apply ASAP Checks']] : BASE_TABS;

  useEffect(() => setItems(rows), [rows]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const today = new Date().toISOString().slice(0, 10);
    const searchRank = row => {
      if (!query) return 0;
      const title = String(row.title || '').toLowerCase();
      const organization = String(row.org || row.source || '').toLowerCase();
      if (title.startsWith(query)) return 0;
      if (title.includes(query)) return 1;
      if (organization.includes(query)) return 2;
      return 3;
    };
    return items.filter(row =>
      (tab === 'all' || tab === 'spotlight' ? (tab === 'all' || row.is_featured) : tab === 'availability' ? row.content_type === 'opportunity' && row.status === 'published' && row.deadline_type === 'rolling' && (row.availability_review?.next_review_at ? row.availability_review.next_review_at <= today : new Date(row.created_at).getTime() <= Date.now() - 30*86400000) : row.content_type === tab)
      && (status === 'active' ? ['pending', 'resubmitted', 'needs_correction', 'published', 'unpublished'].includes(row.status) : !status || row.status === status)
      && (!query || `${row.title} ${row.org || row.source || ''} ${row.description || row.body || ''}`.toLowerCase().includes(query))
      && (sort !== 'past_archived' || row.status === 'archived' || (row.content_type === 'event' && row.date && row.date < today))
    ).sort((left, right) => {
      const rank = searchRank(left) - searchRank(right);
      if (rank) return rank;
      if (sort === 'recently_submitted') return new Date(right.created_at || 0) - new Date(left.created_at || 0);
      if (sort === 'recently_updated') return new Date(right.updated_at || right.created_at || 0) - new Date(left.updated_at || left.created_at || 0);
      const leftUpcoming = left.content_type === 'event' && left.date >= today;
      const rightUpcoming = right.content_type === 'event' && right.date >= today;
      if (leftUpcoming !== rightUpcoming) return leftUpcoming ? -1 : 1;
      if (leftUpcoming && rightUpcoming) return String(left.date).localeCompare(String(right.date));
      return new Date(right.updated_at || right.created_at || 0) - new Date(left.updated_at || left.created_at || 0);
    });
  }, [items, tab, status, search, sort]);

  async function act(row, action) {
    const actionLabel = action === 'soft_delete' ? 'Moving to trash' : action === 'unpublish' ? 'Unpublishing' : action === 'archive' ? 'Archiving' : action === 'restore' ? 'Restoring' : 'Updating';
    setMessage(`${actionLabel} ${row.title}…`);
    const result = await manageContent(row.content_type, row.id, action);
    if (!result.ok) { setMessage(result.error || 'Update failed.'); return; }
    setItems(current => current.map(item => item.id === row.id && item.content_type === row.content_type ? {
      ...item,
      status: action === 'unpublish' ? 'unpublished' : action === 'archive' ? 'archived' : action === 'soft_delete' ? 'deleted' : action === 'restore' ? 'published' : item.status,
      is_featured: ['unpublish', 'archive', 'soft_delete'].includes(action) ? false : item.is_featured,
      spotlight_rank: ['unpublish', 'archive', 'soft_delete'].includes(action) ? null : item.spotlight_rank,
    } : item));
    setMessage('Content action completed and audited.');
    if (!result.demo) router.refresh();
  }

  async function spotlight(row) {
    const next = !row.is_featured;
    if (next && items.filter(item => item.is_featured && item.status === 'published').length >= 3) {
      setMessage('Home Spotlight already has 3 active items. Remove an existing Spotlight item before adding another.');
      return;
    }
    setMessage(`${next ? 'Adding to' : 'Removing from'} Home Spotlight…`);
    const usedPositions = items.filter(item => item.is_featured && item.status === 'published' && item.id !== row.id).map(item => Number(item.spotlight_rank)).filter(rank => rank >= 1 && rank <= 3);
    const nextPosition = [1, 2, 3].find(position => !usedPositions.includes(position)) || 3;
    const result = await setHomeSpotlight(row.content_type, row.id, next, next ? (row.spotlight_rank >= 1 && row.spotlight_rank <= 3 ? row.spotlight_rank : nextPosition) : null);
    if (!result.ok) { setMessage(result.error || 'Spotlight update failed.'); return; }
    setItems(current => current.map(item => item.id === row.id && item.content_type === row.content_type ? {
      ...item,
      is_featured: next,
      spotlight_rank: next ? (row.spotlight_rank >= 1 && row.spotlight_rank <= 3 ? row.spotlight_rank : nextPosition) : null,
    } : item));
    setMessage(next ? 'Added to Home Spotlight.' : 'Removed from Home Spotlight.');
    if (!result.demo) router.refresh();
  }

  async function saveSpotlightRank(row, rank) { const result=await setHomeSpotlight(row.content_type,row.id,true,rank); setMessage(result.ok?'Spotlight position saved.':result.error||'Position could not be saved.'); if(result.ok)setItems(current=>current.map(item=>item.id===row.id&&item.content_type===row.content_type?{...item,spotlight_rank:Number(rank)}:item)); }
  async function highlightAnnouncement(row) {
    const next = !row.pinned;
    if (next && items.filter(item => item.content_type === 'announcement' && item.status === 'published' && item.pinned).length >= 7) {
      setMessage('The homepage announcement area already has 7 highlighted items. Remove one before highlighting another.');
      return;
    }
    setMessage(`${next ? 'Highlighting' : 'Removing'} ${row.title}${next ? ' on' : ' from'} the homepage…`);
    const result = await setHomeAnnouncement(row.id, next);
    if (!result.ok) { setMessage(result.error || 'Homepage announcement update failed.'); return; }
    setItems(current => current.map(item => item.id === row.id && item.content_type === 'announcement' ? { ...item, pinned: next } : item));
    setMessage(next ? 'Announcement highlighted in Latest Announcements.' : 'Announcement returned to normal homepage ordering.');
    if (!result.demo) router.refresh();
  }
  async function confirmAvailability(row){setMessage(`Confirming ${row.title} is still active…`);const result=await confirmOpportunityAvailability(row.id);if(!result.ok){setMessage(result.error||'Availability could not be confirmed.');return;}const review=result.data||{last_verified_at:result.last_verified_at,next_review_at:result.next_review_at};setItems(current=>current.map(item=>item.id===row.id&&item.content_type==='opportunity'?{...item,availability_review:review}:item));setMessage('Availability confirmed. The next review is scheduled in approximately 30 days.');if(!result.demo)router.refresh();}
  async function confirmHardDelete(){if(!deleteTarget)return;const result=await hardDeleteContent(deleteTarget.content_type,deleteTarget.id,deleteReason);if(!result.ok){setMessage(result.error||'Permanent deletion failed.');return;}setItems(current=>current.filter(item=>!(item.id===deleteTarget.id&&item.content_type===deleteTarget.content_type)));setMessage('Content permanently deleted and audited.');setDeleteTarget(null);setDeleteReason('');if(!result.demo)router.refresh();}
  async function confirmAction(){if(!actionTarget)return;await act(actionTarget.row,actionTarget.action);setActionTarget(null);}
  const contentHref = row => row.content_type === 'event' ? `/events/${row.id}` : row.content_type === 'opportunity' ? `/opportunities/${row.id}` : `/announcements/${row.id}`;
  const actionCopy = actionTarget?.action === 'archive'
    ? 'This removes the content from active public views and Spotlight while preserving its history. It can be restored through an audited action.'
    : actionTarget?.action === 'unpublish'
      ? 'This removes the content from public view and Spotlight. Its record and audit history will remain.'
      : 'This hides the record from normal management views while preserving its audit history.';

  return <section className="content-manager" aria-label="Content management">
    <div className="content-manager-controls">
      <label><span>Search content</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Title or organization" /></label>
      <label><span>Status</span><select value={status} onChange={event => setStatus(event.target.value)}>{STATUS_OPTIONS.map(([value, label]) => <option value={value} key={value || 'all'}>{label}</option>)}</select></label>
      <label><span>Sort</span><select value={sort} onChange={event => setSort(event.target.value)}><option value="upcoming">Upcoming</option><option value="recently_submitted">Recently submitted</option><option value="recently_updated">Recently updated</option><option value="past_archived">Past / archived</option></select></label>
    </div>
    <div className="content-tabs" role="tablist" aria-label="Content type">{tabs.map(([value, label]) => <button type="button" role="tab" key={value} aria-selected={tab === value} aria-describedby={value === 'availability' ? 'availability-check-help' : undefined} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>{label} <span>{value === 'all' ? items.length : value === 'spotlight' ? items.filter(item => item.is_featured).length : value === 'availability' ? items.filter(item=>item.content_type==='opportunity'&&item.status==='published'&&item.deadline_type==='rolling'&&(item.availability_review?.next_review_at?item.availability_review.next_review_at<=new Date().toISOString().slice(0,10):new Date(item.created_at).getTime()<=Date.now()-30*86400000)).length : items.filter(item => item.content_type === value).length}</span></button>)}</div>
    {availabilityAccess && <p id="availability-check-help" className="content-tab-help">Apply ASAP Checks lists published opportunities without a firm deadline whose application link is due for a 30-day availability check.</p>}
    <p className="workspace-status" role="status" aria-live="polite">{message || `${filtered.length} records shown.`}</p>
    {filtered.length ? <div className="content-table" role="region" aria-label="Managed content records">{filtered.map(row => <div className="content-record" key={`${row.content_type}-${row.id}`}><article className="content-row">
      <div><div className="eyebrow">{row.content_type} · {statusLabel(row.status)}{row.is_featured ? ' · Home Spotlight' : ''}{row.content_type === 'announcement' && row.pinned ? ' · Homepage highlight' : ''}</div><h2>{row.title}</h2><p>{row.org || row.source || 'Organization not provided'}</p><small>{row.content_type === 'opportunity' ? (row.deadline ? `Deadline ${new Date(row.deadline + 'T12:00:00').toLocaleDateString()}` : deadlineLabel(row.deadline_type, null, row.posted_date)) : row.date ? `Event ${new Date(row.date + 'T12:00:00').toLocaleDateString()}` : 'No date recorded'}</small>{row.submitted_by_user && <small className="content-lifecycle-meta">Submitted by {row.submitted_by_user.full_name || row.submitted_by_user.email || 'Unknown submitter'} · {row.created_at ? new Date(row.created_at).toLocaleString() : 'Submission time unavailable'}</small>}</div>
      <div className="content-row-actions">
        <div className="content-action-group" role="group" aria-label="Open and edit">
          {row.status === 'published' && <Link className="chip" href={contentHref(row)}>View</Link>}
          {['pending', 'resubmitted'].includes(row.status) && <Link className="gold-button" href="/admin/review">Open in Review Queue</Link>}
          {row.status === 'needs_correction' && <span className="content-lifecycle-note">Waiting for contributor correction</span>}
          {row.status === 'rejected' && <span className="content-lifecycle-note">Review closed · history preserved</span>}
          {EDITABLE_STATUSES.has(row.status) && <button className="outline-button" aria-expanded={editorTarget === `${row.content_type}:${row.id}`} onClick={() => setEditorTarget(current => current === `${row.content_type}:${row.id}` ? null : `${row.content_type}:${row.id}`)}>{editorTarget === `${row.content_type}:${row.id}` ? 'Close full edit form' : 'Open full edit form'}</button>}
        </div>
        {row.status === 'published' && <div className="content-action-group content-placement-actions" role="group" aria-label="Homepage placement">
          <button className={row.is_featured ? 'gold-button' : 'chip'} onClick={() => spotlight(row)}>{row.is_featured ? 'Remove from Spotlight' : 'Add to Spotlight'}</button>
          {row.is_featured && <label className="content-order-control"><span>Position</span><select aria-label={`Spotlight position for ${row.title}`} value={Math.min(3, Math.max(1, Number(row.spotlight_rank) || 1))} onChange={event=>saveSpotlightRank(row,event.target.value)}><option value="1">1 · First</option><option value="2">2 · Second</option><option value="3">3 · Third</option></select></label>}
          {row.content_type === 'announcement' && <button className={row.pinned ? 'gold-button' : 'chip'} onClick={() => highlightAnnouncement(row)}>{row.pinned ? 'Remove homepage highlight' : 'Highlight in Latest Announcements'}</button>}
        </div>}
        <div className="content-action-group content-lifecycle-actions" role="group" aria-label="Content status actions">
          {availabilityAccess && row.content_type === 'opportunity' && row.status === 'published' && row.deadline_type === 'rolling' && <><a className="chip" href={row.link} target="_blank" rel="noreferrer">Open application link</a><button className="gold-button" onClick={()=>confirmAvailability(row)}>Confirm still active</button><button className="chip" onClick={()=>setActionTarget({row,action:'archive'})}>Mark closed / archive</button></>}
          {row.status === 'published' && <button className="chip" onClick={() => setActionTarget({ row, action: 'unpublish' })}>Unpublish</button>}
          {['published', 'unpublished'].includes(row.status) && !(availabilityAccess && row.content_type === 'opportunity' && row.status === 'published' && row.deadline_type === 'rolling') && <button className="chip" onClick={() => setActionTarget({ row, action: 'archive' })}>Archive</button>}
          {EDITABLE_STATUSES.has(row.status) && <button className="chip" onClick={() => setActionTarget({ row, action: 'soft_delete' })}>Move to trash</button>}
          {row.status === 'deleted' && <button className="gold-button" onClick={() => act(row, 'restore')}>Restore</button>}
          {superAdmin && row.status === 'deleted' && <button className="danger-button" onClick={()=>setDeleteTarget(row)}>Delete permanently</button>}
        </div>
      </div>
    </article>{editorTarget === `${row.content_type}:${row.id}` && <ContentEditForms rows={[row]} auditEdits={auditEdits} embedded startOpen />}</div>)}</div> : <div className="workspace-empty">No content matches these filters.</div>}
    {deleteTarget&&<dialog open className="history-dialog" aria-labelledby="hard-delete-title"><div className="history-dialog-card"><button type="button" className="history-dialog-close" aria-label="Cancel permanent deletion" onClick={()=>setDeleteTarget(null)}>×</button><div className="eyebrow">Super Admin only</div><h2 id="hard-delete-title">Permanently delete this record?</h2><p><strong>{deleteTarget.title}</strong> cannot be restored. The audit event and deletion reason will remain.</p><label className="hard-delete-reason"><span>Required reason</span><textarea rows="4" minLength="10" value={deleteReason} onChange={event=>setDeleteReason(event.target.value)}/></label><div className="history-dialog-actions"><button className="chip" onClick={()=>setDeleteTarget(null)}>Cancel</button><button className="danger-button" disabled={deleteReason.trim().length<10} onClick={confirmHardDelete}>Delete permanently</button></div></div></dialog>}
    {actionTarget&&<dialog open className="history-dialog" aria-labelledby="content-action-title"><div className="history-dialog-card"><h2 id="content-action-title">{actionTarget.action === 'archive' ? 'Archive this content?' : actionTarget.action === 'unpublish' ? 'Unpublish this content?' : 'Move this content to trash?'}</h2><p><strong>{actionTarget.row.title}</strong></p><p>{actionCopy}</p><div className="history-dialog-actions"><button className="chip" onClick={()=>setActionTarget(null)}>Cancel</button><button className="danger-button" onClick={confirmAction}>{actionTarget.action === 'soft_delete' ? 'Move to trash' : `Confirm ${actionTarget.action}`}</button></div></div></dialog>}
  </section>;
}
