import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getEvent } from '../../../lib/data';

function icsDataUrl(e) {
  const date = e.date.replace(/-/g, '');
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    `SUMMARY:${e.title}`,
    `DTSTART;VALUE=DATE:${date}`,
    `LOCATION:${e.location}`,
    `DESCRIPTION:${e.description}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\n');
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

export default async function EventDetail({ params }) {
  const e = await getEvent(params.id);
  if (!e) return notFound();

  return (
    <div className="pb-16">
      <div className="text-sm text-slate mt-6 mb-4">
        <Link href="/events" className="hover:text-purple-700">Events</Link> / {e.title}
      </div>

      <div className="grid md:grid-cols-[1.7fr_1fr] gap-7 items-start">
        <div className="bg-white border border-line rounded-2xl p-8">
          <div className="flex gap-2 mb-4">
            <span className="font-mono text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded">{e.type}</span>
            <span className="font-mono text-[10px] border border-line text-slate px-2 py-0.5 rounded">
              {(e.majors || []).join(', ')}
            </span>
          </div>
          <h1 className="text-2xl mb-2">{e.title}</h1>
          <div className="flex items-center gap-2 text-sm text-slate mb-6">
            Posted by {e.org}
            {e.verified && (
              <span className="inline-flex items-center gap-1 font-mono text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                ✓ Verified
              </span>
            )}
          </div>

          <Section title="About this event">
            <p className="text-sm leading-relaxed text-ink/80">{e.description}</p>
          </Section>

          <Section title="Details">
            <ul className="text-sm leading-loose text-ink/80 list-disc pl-5">
              <li><strong className="text-ink">Date &amp; time:</strong> {new Date(e.date).toLocaleDateString()} {e.time && `· ${e.time}`}</li>
              <li><strong className="text-ink">Location:</strong> {e.location}</li>
            </ul>
          </Section>
        </div>

        <div>
          <SideCard title="Add to your calendar">
            <a
              href={icsDataUrl(e)}
              download={`${e.title.replace(/\s+/g, '-')}.ics`}
              className="flex items-center justify-center gap-2 border border-line rounded-lg py-3 text-sm hover:border-gold-400"
            >
              Download .ics
            </a>
          </SideCard>

          {e.registration_link && (
            <SideCard title="Register">
              <a
                href={e.registration_link}
                target="_blank"
                rel="noreferrer"
                className="block w-full text-center bg-purple-900 text-white text-sm py-3 rounded-lg hover:bg-purple-700"
              >
                Register →
              </a>
            </SideCard>
          )}

          {e.presenter_name && (
            <SideCard title="Featured presenter">
              <div className="text-sm font-medium">{e.presenter_name}</div>
              {e.presenter_affiliation && (
                <div className="text-xs text-slate mt-0.5">{e.presenter_affiliation}</div>
              )}
              {e.is_alumni_presenter && (
                <span className="inline-block mt-2 font-mono text-[10px] bg-gold-100 text-gold-600 px-2 py-0.5 rounded">
                  PVAMU Alum
                </span>
              )}
              {e.is_sponsor_presenter && (
                <span className="inline-block mt-2 font-mono text-[10px] bg-[#FBEDE5] text-coral px-2 py-0.5 rounded">
                  Sponsor
                </span>
              )}
              <div className="text-xs text-slate mt-3">
                Guest presenter, not the event organizer — for logistics, use the point of contact below.
              </div>
            </SideCard>
          )}

          <SideCard title="Point of contact">
            <div className="text-sm font-medium">{e.contact_name}</div>
            <a href={`mailto:${e.contact_email}`} className="text-sm text-purple-700 block mt-1 hover:underline">
              {e.contact_email}
            </a>
          </SideCard>

          {e.flyer_url && (
            <SideCard title="Original flyer">
              <a href={e.flyer_url} target="_blank" rel="noreferrer" className="block group">
                <img
                  src={e.flyer_url}
                  alt="Original flyer"
                  className="w-full rounded-lg border border-line group-hover:border-gold-400"
                />
                <span className="text-xs text-purple-700 mt-2 inline-block group-hover:underline">
                  View original flyer →
                </span>
              </a>
            </SideCard>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-6">
      <h3 className="font-mono text-xs uppercase tracking-wide text-slate mb-2">{title}</h3>
      {children}
    </div>
  );
}

function SideCard({ title, children }) {
  return (
    <div className="bg-white border border-line rounded-2xl p-6 mb-4">
      <h3 className="font-mono text-[11px] uppercase tracking-wide text-slate mb-4">{title}</h3>
      {children}
    </div>
  );
}
