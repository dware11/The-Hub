'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { EVENT_FILTERS, REGISTERED_EVENT_ORGANIZATIONS, eventCategories, eventCategoryClass, matchesEventCategories, matchesEventOrganizations } from '../lib/eventCategories';
import { matchesSearch } from '../lib/search';

const asDate = value => new Date(`${value}T12:00:00`);
const PAGE_SIZES = [10, 20, 50];

export default function EventsAllBrowser({ events, initialDate = '' }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [organization, setOrganization] = useState('');
  const [range, setRange] = useState('upcoming');
  const [specificDate, setSpecificDate] = useState(initialDate);
  const [sort, setSort] = useState('soonest');
  const [filtersOpen, setFiltersOpen] = useState(Boolean(initialDate));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const shown = useMemo(() => {
    const now = new Date();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return events.filter(event =>
      (!category || matchesEventCategories(event, [category]))
      && (!organization || matchesEventOrganizations(event, [organization]))
      && matchesSearch([event.title, event.org, event.description, event.location], search)
      && (specificDate
        ? event.date === specificDate
        : (range === 'all' || (range === 'month' ? asDate(event.date) <= monthEnd : asDate(event.end_date || event.date) >= now)))
    ).sort((a, b) => (sort === 'latest' ? -1 : 1) * (asDate(a.date) - asDate(b.date)));
  }, [events, search, category, organization, range, specificDate, sort]);

  useEffect(() => setPage(1), [search, category, organization, range, specificDate, sort, pageSize]);
  const pageCount = Math.max(1, Math.ceil(shown.length / pageSize));
  const visible = shown.slice((page - 1) * pageSize, page * pageSize);
  const clear = () => {
    setSearch('');
    setCategory('');
    setOrganization('');
    setRange('upcoming');
    setSpecificDate('');
    setSort('soonest');
  };

  return <section className="events-all-section" id="all-events">
    <header className="events-all-heading"><div><div className="eyebrow">Event Browser</div><h2>Find what matters.</h2><p>Search the complete published event collection.</p></div><label>Sort by<select value={sort} onChange={event => setSort(event.target.value)}><option value="soonest">Soonest First</option><option value="latest">Latest First</option></select></label></header>
    <div className="events-all-toolbar">
      <label className="events-search"><span>Search events</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search events…" /></label>
      <button type="button" className="events-filter-toggle" onClick={() => setFiltersOpen(value => !value)} aria-expanded={filtersOpen}>Filters{specificDate ? ' · date selected' : ''}</button>
      <div className={`events-advanced-filters${filtersOpen ? ' is-open' : ''}`}>
        <label><span>Category</span><select value={category} onChange={event => setCategory(event.target.value)}><option value="">All Categories</option>{EVENT_FILTERS.slice(1).map(value => <option key={value}>{value}</option>)}</select></label>
        <label><span>Organization</span><select value={organization} onChange={event => setOrganization(event.target.value)}><option value="">All Organizations</option>{REGISTERED_EVENT_ORGANIZATIONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label><span>Date range</span><select value={range} disabled={Boolean(specificDate)} onChange={event => setRange(event.target.value)}><option value="upcoming">Upcoming</option><option value="month">This Month</option><option value="all">All Time</option></select></label>
        <label><span>Specific date</span><input type="date" value={specificDate} onChange={event => setSpecificDate(event.target.value)} /></label>
        <button type="button" onClick={clear}>Clear Filters</button>
      </div>
    </div>
    {specificDate && <p className="events-date-filter-note" role="status">Showing events on <strong>{asDate(specificDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</strong>.</p>}
    <div className="events-result-row"><p className="events-result-count" aria-live="polite">{shown.length} {shown.length === 1 ? 'event' : 'events'} found</p><label>Show <select value={pageSize} onChange={event => setPageSize(Number(event.target.value))}>{PAGE_SIZES.map(size => <option key={size}>{size}</option>)}</select> per page</label></div>
    {shown.length
      ? <div className="events-card-grid">{visible.map(event => <Link className={`events-editorial-card ${eventCategoryClass(event)}`} href={`/events/${event.id}`} key={event.id}><div className="events-card-date"><span>{asDate(event.date).toLocaleDateString('en-US', { month: 'short' })}</span><strong>{asDate(event.date).getDate()}</strong></div><div className="events-card-content"><div className="events-card-label">{eventCategories(event).join(' · ')}</div><h3>{event.title}</h3><p>{event.org}</p><div className="events-card-meta">{event.time && <span>{event.time}</span>}{event.location && <span>{event.location}</span>}</div><b>View Event <span aria-hidden="true">→</span></b></div></Link>)}</div>
      : <div className="events-empty" role="status"><h3>{specificDate ? 'No events on this date' : 'No matching events'}</h3><p>Choose another date or clear the filters to browse all upcoming events.</p><button type="button" onClick={clear}>Clear filters</button></div>}
    {pageCount > 1 && <nav className="announcement-pagination public-pagination" aria-label="Event pages"><button type="button" disabled={page === 1} onClick={() => setPage(value => value - 1)} aria-label="Previous page">←</button>{Array.from({ length: pageCount }, (_, index) => index + 1).map(number => <button type="button" key={number} className={number === page ? 'active' : ''} aria-current={number === page ? 'page' : undefined} aria-label={`Go to page ${number}`} onClick={() => setPage(number)}>{number}</button>)}<button type="button" disabled={page === pageCount} onClick={() => setPage(value => value + 1)} aria-label="Next page">→</button></nav>}
  </section>;
}
