'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { matchesSearch } from '../lib/search';
import { announcementCategory } from '../lib/announcementCategories';

const PAGE_SIZE = 6;
const publicationValue = item => item.published_at || item.created_at;

function displayDate(item, long = false) {
  const value = publicationValue(item);
  if (!value) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-US', long ? { month: 'long', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function categoryMark(category) {
  return ({ College: '◆', 'C.O.D.E.': '✦', Department: '▦', Academic: '◆', Event: '◇', 'Student Organization': '●', General: '□' })[category] || '□';
}

export default function AnnouncementsBrowser({ items }) {
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('');
  const [category, setCategory] = useState('');
  const [range, setRange] = useState('all');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);

  const sources = useMemo(() => [...new Set(items.map(item => item.source).filter(Boolean))].sort(), [items]);
  const categories = useMemo(() => [...new Set(items.map(item => announcementCategory(item.category)))].sort(), [items]);
  const filtered = useMemo(() => items.filter(item => {
    const published = new Date(publicationValue(item) || 0);
    const cutoff = range === '30' ? Date.now() - 30 * 86400000 : range === '90' ? Date.now() - 90 * 86400000 : 0;
    return matchesSearch([item.title, item.body, item.source], search) && (!source || item.source === source) && (!category || announcementCategory(item.category) === category) && (!cutoff || published.getTime() >= cutoff);
  }).sort((a, b) => {
    const difference = new Date(publicationValue(b) || 0) - new Date(publicationValue(a) || 0);
    return sort === 'oldest' ? -difference : difference;
  }), [items, search, source, category, range, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const start = filtered.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const end = Math.min(page * PAGE_SIZE, filtered.length);

  useEffect(() => setPage(1), [search, source, category, range, sort]);

  function clear() { setSearch(''); setSource(''); setCategory(''); setRange('all'); setSort('newest'); }
  return <>
    <section className="announcement-toolbar" aria-label="Announcement filters">
      <label className="announcement-search"><span>Search</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search announcements…" /></label>
      <label><span>Source</span><select value={source} onChange={event => setSource(event.target.value)}><option value="">All sources</option>{sources.map(value => <option key={value}>{value}</option>)}</select></label>
      <label><span>Category</span><select value={category} onChange={event => setCategory(event.target.value)}><option value="">All categories</option>{categories.map(value => <option key={value}>{value}</option>)}</select></label>
      <label><span>Date range</span><select value={range} onChange={event => setRange(event.target.value)}><option value="all">All time</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></label>
      <button type="button" className="announcement-clear" onClick={clear}>Clear filters</button>
    </section>

    <section className="announcement-list-section">
      <div className="announcement-list-heading"><div><div className="eyebrow">All announcements</div><p>Latest updates from the College, C.O.D.E., departments, and our engineering community.</p></div><label><span>Sort by</span><select value={sort} onChange={event => setSort(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label></div>
      <p className="sr-only" role="status" aria-live="polite">{filtered.length} announcements match the selected filters.</p>
      {!items.length ? <div className="empty-results announcement-empty"><h2>No announcements right now.</h2><p>More updates are coming soon, so check back later.</p></div> : visible.length ? <div className="announcement-list">{visible.map(item => {
        const itemCategory = announcementCategory(item.category);
        return <article className="announcement-row" key={item.id}><div className="announcement-category-pill"><span aria-hidden="true">{categoryMark(itemCategory)}</span>{itemCategory}</div><div className="announcement-row-title"><h2><Link href={`/announcements/${item.id}`}>{item.title}</Link></h2><p>{item.source}</p></div><p className="announcement-preview">{item.body}</p><time dateTime={publicationValue(item)}>{displayDate(item)}</time><Link className="announcement-row-action" href={`/announcements/${item.id}`} aria-label={`Read ${item.title}`}>→</Link></article>;
      })}</div> : <div className="empty-results"><h2>No matching announcements</h2><p>Clear a filter or choose a broader option.</p></div>}
      <div className="announcement-pagination-wrap">
        {pageCount > 1 ? <nav className="announcement-pagination" aria-label="Announcement pages"><button type="button" disabled={page === 1} onClick={() => setPage(value => value - 1)} aria-label="Previous page">←</button>{Array.from({ length: pageCount }, (_, index) => index + 1).map(number => <button type="button" key={number} className={number === page ? 'active' : ''} aria-current={number === page ? 'page' : undefined} onClick={() => setPage(number)}>{number}</button>)}<button type="button" disabled={page === pageCount} onClick={() => setPage(value => value + 1)} aria-label="Next page">→</button></nav> : <span />}
        <p>Showing {start}–{end} of {filtered.length} announcement{filtered.length === 1 ? '' : 's'}</p>
      </div>
    </section>
  </>;
}
