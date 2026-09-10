'use client';

import { useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import EventsCalendar from './EventsCalendar';
import EventFilterControls from './EventFilterControls';
import { EVENT_FILTERS, eventOrganizations, matchesEventCategories, matchesEventOrganizations, priorityCalendarEvents } from '../lib/eventCategories';
import { matchesSearch } from '../lib/search';

export default function EventsCalendarBrowser({ events }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selected = useMemo(() => searchParams.getAll('category').filter((value) => EVENT_FILTERS.slice(1).includes(value)), [searchParams]);
  const organizations = useMemo(() => eventOrganizations(events), [events]);
  const selectedOrganizations = useMemo(() => searchParams.getAll('organization').filter((value) => organizations.some((item) => item.value === value)), [searchParams, organizations]);
  const search = searchParams.get('q') || '';
  const defaultCurated = selected.length === 0 && selectedOrganizations.length === 0 && !search && events.length > 35;
  const shown = useMemo(
    () => (defaultCurated ? priorityCalendarEvents(events) : events).filter((event) => matchesEventCategories(event, selected) && matchesEventOrganizations(event, selectedOrganizations) && matchesSearch([event.title,event.org,event.description,event.location], search)),
    [events, selected, selectedOrganizations, search, defaultCurated]
  );

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

  function updateSearch(value) { const params = new URLSearchParams(searchParams.toString()); if (value) params.set('q', value); else params.delete('q'); router.replace(`${pathname}${params.toString() ? `?${params}` : ''}`, { scroll: false }); }
  return <>
    <EventFilterControls selected={selected} onToggle={toggle} onClear={() => updateCategories([])} selectedOrganizations={selectedOrganizations} onOrganizationToggle={toggleOrganization} onOrganizationClear={() => updateOrganizations([])} onClearAll={clearAll} count={shown.length} organizations={organizations} defaultCurated={defaultCurated} />
    {!shown.length && <div className="empty-results" role="status"><h2>No matching events</h2><p>Clear one or more category filters, or check back as verified events are added.</p></div>}
    <EventsCalendar events={shown} />
  </>;
}
