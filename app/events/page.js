import { getEvents } from '../../lib/data';
import MajorFilter from '../../components/MajorFilter';
import EventsCalendar from '../../components/EventsCalendar';

export default async function EventsPage({ searchParams }) {
  const { major } = await searchParams;
  const events = await getEvents(major);

  return (
    <div className="pb-16">
      <div className="mt-9 mb-6 flex justify-between items-end flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl text-purple-900">Events</h1>
          <div className="text-sm text-slate mt-1">
            One shared calendar — college events, org meetings, workshops &amp; more
          </div>
        </div>
        <MajorFilter current={major} />
      </div>

      <EventsCalendar events={events} />
    </div>
  );
}
