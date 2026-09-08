'use client';

import { useMemo, useState } from 'react';

function rowDate(row) {
  const value = new Date(row.created_at || '');
  return Number.isNaN(value.getTime()) ? null : value;
}

export default function HistoryBrowser({ rows, demo }) {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [action, setAction] = useState('');
  const [actor, setActor] = useState('');
  const [record, setRecord] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState('newest');

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
        const haystack = `${row.action || ''} ${row.actor_id || ''} ${row.content_type || ''} ${row.content_id || ''} ${row.reason || ''}`.toLowerCase();
        return (!needle || haystack.includes(needle))
          && (!type || row.content_type === type)
          && (!actionNeedle || String(row.action || '').toLowerCase().includes(actionNeedle))
          && (!actorNeedle || String(row.actor_id || '').toLowerCase().includes(actorNeedle))
          && (!recordNeedle || String(row.content_id || '').toLowerCase().includes(recordNeedle))
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
      <label><span>Actor/user ID</span><input value={actor} onChange={(event) => setActor(event.target.value)} placeholder="UUID or actor" /></label>
      <label><span>Affected record</span><input value={record} onChange={(event) => setRecord(event.target.value)} placeholder="Content UUID" /></label>
      <label><span>From date</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
      <label><span>To date</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
      <label><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label>
    </div>
    {demo && <p className="workspace-status" role="status">Demo mode: no audit rows are fabricated. Live audit history appears after Supabase is configured.</p>}
    {filtered.length ? <div className="history-table">{filtered.map((row) => <article className="history-row" key={row.id}><div><div className="eyebrow">{row.action} · {row.content_type}</div><strong>{row.reason || 'Audited system action'}</strong><small>{rowDate(row)?.toLocaleString() || 'Timestamp unavailable'}</small></div><div><span>Actor {row.actor_id || 'System'}</span>{row.content_id && <span>Record {row.content_id}</span>}</div></article>)}</div> : <div className="workspace-empty">{demo ? 'No demo audit history is displayed.' : 'No audit events match these filters.'}</div>}
  </section>;
}
