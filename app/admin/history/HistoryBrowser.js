'use client';

import { useMemo, useState } from 'react';

function rowDate(row) {
  const value = new Date(row.created_at || '');
  return Number.isNaN(value.getTime()) ? null : value;
}

const humanize = value => String(value || 'system action').replace(/^content_/, '').replace(/^home_/, 'home ').replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
const actorName = row => row.actor?.full_name || row.actor?.email || (row.actor_type === 'system' ? 'System' : 'Former workspace user');

export default function HistoryBrowser({ rows, demo }) {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [action, setAction] = useState('');
  const [actor, setActor] = useState('');
  const [record, setRecord] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState('newest');
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const actionNeedle = action.trim().toLowerCase();
    const actorNeedle = actor.trim().toLowerCase();
    const recordNeedle = record.trim().toLowerCase();
    const fromTime = from ? new Date(`${from}T00:00:00`).getTime() : null;
    const toTime = to ? new Date(`${to}T23:59:59.999`).getTime() : null;

    return rows
      .filter((row) => {
        const rowTime = rowDate(row)?.getTime() ?? null;
        const haystack = `${row.action || ''} ${actorName(row)} ${row.actor?.role || ''} ${row.content_type || ''} ${row.target_title || ''} ${row.reason || ''}`.toLowerCase();
        return (!needle || haystack.includes(needle))
          && (!type || row.content_type === type)
          && (!actionNeedle || String(row.action || '').toLowerCase().includes(actionNeedle))
          && (!actorNeedle || `${actorName(row)} ${row.actor?.role || ''}`.toLowerCase().includes(actorNeedle))
          && (!recordNeedle || `${row.target_title || ''} ${row.content_type || ''}`.toLowerCase().includes(recordNeedle))
          && (fromTime === null || (rowTime !== null && rowTime >= fromTime))
          && (toTime === null || (rowTime !== null && rowTime <= toTime));
      })
      .sort((a, b) => {
        const left = rowDate(a)?.getTime() ?? 0;
        const right = rowDate(b)?.getTime() ?? 0;
        return sort === 'oldest' ? left - right : right - left;
      });
  }, [rows, search, type, action, actor, record, from, to, sort]);

  return <section className="history-browser" aria-label="Audit history browser">
    <div className="history-controls">
      <label><span>Search history</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Reason, action, actor, or record" /></label>
      <label><span>Content type</span><select value={type} onChange={(event) => setType(event.target.value)}><option value="">All types</option><option value="opportunity">Opportunity</option><option value="event">Event</option><option value="announcement">Announcement</option><option value="system">System</option></select></label>
      <label><span>Action</span><input value={action} onChange={(event) => setAction(event.target.value)} placeholder="e.g. approved" /></label>
      <label><span>Actor</span><input value={actor} onChange={(event) => setActor(event.target.value)} placeholder="Name, email, or role" /></label>
      <label><span>Affected record</span><input value={record} onChange={(event) => setRecord(event.target.value)} placeholder="Title or content type" /></label>
      <label><span>From date</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
      <label><span>To date</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
      <label><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label>
    </div>
    {demo && <p className="workspace-status" role="status">Demo mode: no audit rows are fabricated. Live audit history appears after Supabase is configured.</p>}
    {filtered.length ? <div className="history-table">{filtered.map((row) => <button type="button" className="history-row" key={row.id} onClick={() => setSelected(row)}><div><div className="eyebrow">{humanize(row.action)} · {humanize(row.content_type)}</div><strong>{row.target_title || row.reason || humanize(row.action)}</strong><small>{rowDate(row)?.toLocaleString() || 'Timestamp unavailable'}</small></div><div><span>{actorName(row)}</span><span>{humanize(row.actor?.role || row.actor_type)}</span></div></button>)}</div> : <div className="workspace-empty">{demo ? 'No demo audit history is displayed.' : 'No audit events match these filters.'}</div>}
    {selected && <dialog open className="history-dialog" aria-labelledby="history-detail-title" onKeyDown={event => { if (event.key === 'Escape') setSelected(null); }}><div className="history-dialog-card"><button type="button" className="history-dialog-close" aria-label="Close history detail" onClick={() => setSelected(null)}>×</button><div className="eyebrow">Audit event</div><h2 id="history-detail-title">{humanize(selected.action)}</h2><dl><dt>Actor</dt><dd>{actorName(selected)}</dd><dt>Role</dt><dd>{humanize(selected.actor?.role || selected.actor_type)}</dd><dt>Time</dt><dd>{rowDate(selected)?.toLocaleString() || 'Unavailable'}</dd><dt>Object</dt><dd>{selected.target_title || humanize(selected.content_type)}</dd><dt>Action</dt><dd>{humanize(selected.action)}</dd>{selected.previous_status && <><dt>Previous</dt><dd>{humanize(selected.previous_status)}</dd></>}{selected.new_status && <><dt>New</dt><dd>{humanize(selected.new_status)}</dd></>}{selected.reason && <><dt>Reason</dt><dd>{selected.reason}</dd></>}</dl>{selected.changes && Object.keys(selected.changes).length > 0 && <details><summary>Changed fields</summary><pre>{JSON.stringify(selected.changes, null, 2)}</pre></details>}<small>Related audit event: {selected.id}</small></div></dialog>}
  </section>;
}
