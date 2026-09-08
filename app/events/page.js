import { Suspense } from 'react';
import { getEvents } from '../../lib/data';
import EventsCalendarBrowser from '../../components/EventsCalendarBrowser';
export const metadata = { title: 'Events' };

export default async function EventsPage() {
  const events = await getEvents();
  return <div className="events-page">
    <header className="events-intro editorial-intro">
      <div className="eyebrow">Events</div>
      <h1>What’s happening across <em>engineering.</em></h1>
      <p>Workshops, info sessions, organization meetings, and College events — all in one place.</p>
    </header>
    <section className="events-calendar-section" aria-labelledby="calendar-heading"><div className="events-section-title"><div><span>Central Calendar</span><h2 id="calendar-heading">Engineering at a glance.</h2></div><a href="/events/all">View all events <b aria-hidden="true">→</b></a></div><Suspense fallback={<p className="text-sm text-slate" role="status">Loading event filters…</p>}><EventsCalendarBrowser events={events}/></Suspense></section>
  </div>;
}
