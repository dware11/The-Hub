'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import EventFilterControls from './EventFilterControls';
import { EVENT_FILTERS, REGISTERED_EVENT_ORGANIZATIONS, eventCategories, eventCategoryClass, matchesEventCategories, matchesEventOrganizations } from '../lib/eventCategories';
import { matchesSearch } from '../lib/search';

function displayDate(date) {
  return new Date(date + 'T00:00:00').toLocaleDateString();
}

export default function AllEventsGrid({ events }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selected = useMemo(() => searchParams.getAll('category').filter((value) => EVENT_FILTERS.slice(1).includes(value)), [searchParams]);
  const selectedOrganizations = useMemo(() => searchParams.getAll('organization').filter((value) => REGISTERED_EVENT_ORGANIZATIONS.some((item) => item.value === value)), [searchParams]);
  const search = searchParams.get('q') || '';
  const shown = useMemo(() => events.filter((event) => matchesEventCategories(event, selected) && matchesEventOrganizations(event, selectedOrganizations) && matchesSearch([event.title,event.org,event.description,event.location], search)), [events, selected, selectedOrganizations, search]);

  function updateCategories(next) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('category');
    next.forEach((category) => params.append('category', category));
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function updateOrganizations(next) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('organization');
    next.forEach((organization) => params.append('organization', organization));
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function toggle(category) {
    updateCategories(selected.includes(category) ? selected.filter((value) => value !== category) : [...selected, category]);
  }

  function toggleOrganization(organization) {
    updateOrganizations(selectedOrganizations.includes(organization) ? selectedOrganizations.filter((value) => value !== organization) : [...selectedOrganizations, organization]);
  }

  function clearAll() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('category');
    params.delete('organization');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function updateSearch(value){const params=new URLSearchParams(searchParams.toString());if(value)params.set('q',value);else params.delete('q');router.replace(`${pathname}${params.toString()?`?${params}`:''}`,{scroll:false});}
  return <>
    <label className="page-search"><span>Search all events</span><input value={search} onChange={e=>updateSearch(e.target.value)} placeholder="Search title or organization" /></label>
    <EventFilterControls selected={selected} onToggle={toggle} onClear={() => updateCategories([])} selectedOrganizations={selectedOrganizations} onOrganizationToggle={toggleOrganization} onOrganizationClear={() => updateOrganizations([])} onClearAll={clearAll} count={shown.length} label="Filter all events by category" />
    <div className="card-grid">
      {shown.map((event) => <Link className={`card event-list-card ${eventCategoryClass(event)}`} href={'/events/' + event.id} key={event.id}>
        <div className="eyebrow">{eventCategories(event).join(' · ')}</div>
        <h3>{event.title}</h3>
        <p>{displayDate(event.date)}{event.end_date ? ' – ' + displayDate(event.end_date) : ''} · {event.time}</p>
        <small>{event.location}</small>
      </Link>)}
    </div>
    {!shown.length && <div className="empty-results" role="status"><h2>No matching events</h2><p>Clear one or more category filters, or check back as verified events are added.</p></div>}
  </>;
}
