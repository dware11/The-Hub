import Link from 'next/link';
import { getOpportunities, getEvents, getAnnouncements } from '../lib/data';

function daysUntil(dateStr) {
  const diff = Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
  return diff;
}

export default async function HomePage() {
  const [opportunities, events, announcements] = await Promise.all([
    getOpportunities(),
    getEvents(),
    getAnnouncements(),
  ]);

  const closingSoon = [...opportunities].sort(
    (a, b) => new Date(a.deadline) - new Date(b.deadline)
  )[0];
  const upcomingDeadlines = [...opportunities]
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
    .slice(0, 4);
  const thisWeekEvents = [...events]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 3);

  return (
    <div className="pb-16">
      <div className="flex justify-between items-baseline mt-9 flex-wrap gap-2">
        <h1 className="font-display text-2xl text-purple-900">Good afternoon, Engineers.</h1>
        <span className="font-mono text-sm text-slate">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </span>
      </div>

      {closingSoon && (
        <div className="mt-5 border border-purple-900 border-l-4 border-l-gold-600 rounded-xl bg-purple-900 text-white px-6 py-5 flex justify-between items-center gap-5 flex-wrap">
          <div>
            <span className="font-mono text-xs uppercase tracking-wider text-gold-400 block mb-1">
              Closing soon
            </span>
            <div className="font-display text-lg font-semibold">{closingSoon.title}</div>
            <div className="text-sm text-purple-100">{closingSoon.org}</div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center bg-white/10 border border-white/20 rounded-lg px-4 py-2">
              <div className="text-xl font-mono font-semibold text-gold-400">
                {daysUntil(closingSoon.deadline)}
              </div>
              <div className="text-[9px] uppercase tracking-wider text-purple-100">days left</div>
            </div>
            <Link
              href={`/opportunities/${closingSoon.id}`}
              className="border border-gold-400 text-gold-400 text-sm px-4 py-2 rounded-lg hover:bg-gold-400 hover:text-purple-900"
            >
              View &amp; apply
            </Link>
          </div>
        </div>
      )}

      <SectionLabel>This week's events</SectionLabel>
      <div className="grid md:grid-cols-3 gap-4">
        {thisWeekEvents.map((e) => (
          <Link
            href={`/events/${e.id}`}
            key={e.id}
            className="border border-line rounded-lg p-4 flex items-center gap-3 hover:border-gold-400"
          >
            <div className="w-11 h-11 rounded-lg bg-purple-100 text-purple-700 flex flex-col items-center justify-center flex-shrink-0">
              <span className="text-sm font-semibold leading-none">
                {new Date(e.date).getDate()}
              </span>
              <span className="text-[9px] uppercase">
                {new Date(e.date).toLocaleDateString('en-US', { month: 'short' })}
              </span>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{e.title}</div>
              <div className="text-xs font-semibold text-ink">{e.time} · {e.location}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-[1.5fr_1fr] gap-6 mt-10">
        <div>
          <SectionLabel>Featured opportunity</SectionLabel>
          {closingSoon && (
            <div className="bg-white border border-line rounded-xl p-6">
              <div className="flex gap-2 mb-3">
                <Tag>{closingSoon.type}</Tag>
                {closingSoon.paid && <Tag gold>Paid</Tag>}
              </div>
              <div className="text-lg font-medium">{closingSoon.title}</div>
              <div className="text-sm text-slate mb-3">Posted by {closingSoon.org}</div>
              <p className="text-sm text-ink/80 mb-4">{closingSoon.description}</p>
              <div className="flex justify-between items-center pt-3 border-t border-line">
                <span className="font-mono text-sm text-coral">
                  Apply by {new Date(closingSoon.deadline).toLocaleDateString()}
                </span>
                <Link href={`/opportunities/${closingSoon.id}`} className="text-sm border border-line rounded-lg px-3 py-1.5 hover:border-gold-400">
                  Details →
                </Link>
              </div>
            </div>
          )}
        </div>
        <div>
          <SectionLabel>Upcoming deadlines</SectionLabel>
          <div className="bg-white border border-line rounded-xl p-5">
            {upcomingDeadlines.map((o) => (
              <Link
                href={`/opportunities/${o.id}`}
                key={o.id}
                className="flex justify-between items-center py-2.5 border-b border-line last:border-0"
              >
                <span className="font-mono text-xs text-slate w-14">
                  {new Date(o.deadline).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })}
                </span>
                <span className="text-sm flex-1 px-2 truncate">{o.title}</span>
                <span className="font-mono text-xs bg-[#FBEDE5] text-coral rounded px-2 py-0.5">
                  {daysUntil(o.deadline)}d
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mt-10">
        <div>
          <SectionLabel>Recent announcements</SectionLabel>
          <div className="bg-white border border-line rounded-xl p-5">
            {announcements.slice(0, 3).map((a) => (
              <div key={a.id} className="py-3 border-b border-line last:border-0">
                <span className="font-mono text-[10px] uppercase text-purple-700 block mb-1">
                  {a.source}
                </span>
                <div className="text-sm text-ink/80">{a.title}</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <SectionLabel>Quick links</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            {['Internships', 'Research', 'Scholarships', 'Competitions'].map((q) => (
              <Link
                href="/opportunities"
                key={q}
                className="border border-line rounded-lg p-4 hover:border-gold-400 hover:-translate-y-0.5 transition"
              >
                <div className="font-display font-semibold text-sm">{q}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-3 mt-11 mb-4">
      <span className="w-1.5 h-1.5 bg-gold-600 rounded-sm flex-shrink-0" />
      <div className="flex-1 h-px bg-line relative">
        <div className="absolute left-0 top-0 h-px w-11 bg-gold-600" />
      </div>
      <span className="font-mono text-[11px] uppercase tracking-wider text-slate whitespace-nowrap">
        {children}
      </span>
    </div>
  );
}

function Tag({ children, gold }) {
  return (
    <span
      className={`font-mono text-[10px] px-2 py-0.5 rounded ${
        gold ? 'bg-gold-100 text-gold-600' : 'bg-purple-100 text-purple-700'
      }`}
    >
      {children}
    </span>
  );
}
