'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const TYPE_GROUPS = {
  'Org meeting': 'meeting',
  Workshop: 'workshop',
  'Career fair': 'career',
  Competition: 'gold',
  'College event': 'gold',
};

const PILL_STYLES = {
  meeting: { pill: 'bg-purple-100 text-purple-700', dot: 'bg-purple-700' },
  workshop: { pill: 'bg-[#E5F3EE] text-[#0F6E56]', dot: 'bg-[#0F6E56]' },
  career: { pill: 'bg-gold-100 text-coral', dot: 'bg-coral' },
  gold: { pill: 'bg-gold-100 text-gold-600', dot: 'bg-gold-600' },
};

function styleFor(type) {
  return PILL_STYLES[TYPE_GROUPS[type] || 'meeting'];
}

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function EventsCalendar({ events }) {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [view, setView] = useState('month');

  const eventsByDate = useMemo(() => {
    const map = {};
    for (const e of events) {
      (map[e.date] = map[e.date] || []).push(e);
    }
    return map;
  }, [events]);

  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const list = [];
    for (let i = 0; i < firstWeekday; i++) list.push(null);
    for (let d = 1; d <= daysInMonth; d++) list.push(new Date(year, month, d));
    return list;
  }, [cursor]);

  const monthLabel = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const todayIso = isoDate(today);

  return (
    <div className="bg-white border border-line rounded-2xl p-5 mb-8">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            aria-label="Previous month"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="w-8 h-8 rounded-md border border-line flex items-center justify-center text-slate hover:border-gold-400 hover:text-ink"
          >
            ‹
          </button>
          <span className="font-display font-semibold text-purple-900 min-w-[150px] text-center">{monthLabel}</span>
          <button
            aria-label="Next month"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="w-8 h-8 rounded-md border border-line flex items-center justify-center text-slate hover:border-gold-400 hover:text-ink"
          >
            ›
          </button>
        </div>

        <div className="flex flex-wrap gap-4 text-[11.5px] text-slate">
          <Legend swatch="bg-purple-700" label="Org meeting" />
          <Legend swatch="bg-[#0F6E56]" label="Workshop" />
          <Legend swatch="bg-coral" label="Employer / career" />
          <Legend swatch="bg-gold-600" label="Competition / college" />
        </div>

        <div className="flex border border-line rounded-md overflow-hidden font-mono text-[11.5px]">
          <button
            onClick={() => setView('month')}
            className={`px-3 py-1.5 ${view === 'month' ? 'bg-purple-900 text-white' : 'bg-white text-slate'}`}
          >
            Month
          </button>
          <button
            onClick={() => setView('list')}
            className={`px-3 py-1.5 ${view === 'list' ? 'bg-purple-900 text-white' : 'bg-white text-slate'}`}
          >
            List
          </button>
        </div>
      </div>

      {view === 'month' ? (
        <div className="grid grid-cols-7 border-t border-l border-line">
          {WEEKDAYS.map((w) => (
            <div key={w} className="font-mono text-[10.5px] uppercase tracking-wide text-slate text-center py-2 border-r border-b border-line bg-paper">
              {w}
            </div>
          ))}
          {cells.map((date, i) =>
            date === null ? (
              <div key={i} className="min-h-[92px] border-r border-b border-line bg-[#FCFBFA]" />
            ) : (
              <CalCell key={i} date={date} isToday={isoDate(date) === todayIso} dayEvents={eventsByDate[isoDate(date)] || []} />
            )
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {events
            .slice()
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .map((e) => (
              <Link
                key={e.id}
                href={`/events/${e.id}`}
                className="flex items-center gap-4 border border-line rounded-lg px-4 py-3 hover:border-gold-400"
              >
                <div className="font-mono text-center w-12 flex-shrink-0">
                  <div className="text-base font-semibold text-purple-900 leading-none">{new Date(e.date).getDate()}</div>
                  <div className="text-[9.5px] uppercase text-slate">{new Date(e.date).toLocaleDateString('en-US', { month: 'short' })}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-display font-semibold text-sm truncate">{e.title}</div>
                  <div className="text-xs text-ink font-semibold">{e.time} {e.time && '· '}{e.location}</div>
                </div>
                <span className={`font-mono text-[10px] px-2 py-0.5 rounded flex-shrink-0 ${styleFor(e.type).pill}`}>{e.type}</span>
              </Link>
            ))}
          {events.length === 0 && <div className="text-sm text-slate py-8 text-center">No events posted yet.</div>}
        </div>
      )}
    </div>
  );
}

function Legend({ swatch, label }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${swatch}`} />
      {label}
    </span>
  );
}

function CalCell({ date, isToday, dayEvents }) {
  const shown = dayEvents.slice(0, 2);
  const extra = dayEvents.length - shown.length;
  return (
    <div className="min-h-[92px] border-r border-b border-line p-2 flex flex-col gap-1">
      <span
        className={`font-mono text-xs w-[22px] h-[22px] flex items-center justify-center rounded-full ${
          isToday ? 'bg-gold-400 text-purple-900 font-semibold' : 'text-ink'
        }`}
      >
        {date.getDate()}
      </span>
      {shown.map((e) => (
        <Link
          key={e.id}
          href={`/events/${e.id}`}
          className={`flex items-center gap-1.5 text-[10.5px] px-1.5 py-0.5 rounded truncate ${styleFor(e.type).pill}`}
          title={e.title}
        >
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${styleFor(e.type).dot}`} />
          <span className="truncate">{e.title}</span>
        </Link>
      ))}
      {extra > 0 && <span className="font-mono text-[10px] text-slate pl-1.5">+{extra} more</span>}
    </div>
  );
}
