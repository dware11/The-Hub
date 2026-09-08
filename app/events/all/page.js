import { getEvents } from '../../../lib/data';
import EventsAllBrowser from '../../../components/EventsAllBrowser';

export const metadata = { title: 'All Events' };

export default async function AllEventsPage({ searchParams }) {
  const events = await getEvents();
  const { date = '' } = await searchParams;
  const initialDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '';
  return <div className="events-page events-all-page"><header className="events-intro"><div className="eyebrow">All Events</div><h1>Explore the full <em>calendar.</em></h1><p>Browse upcoming engineering and campus events by category, organization, and date.</p><a className="events-back-calendar" href="/events">← Back to monthly calendar</a></header><EventsAllBrowser events={events} initialDate={initialDate} /></div>;
}
