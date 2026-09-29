'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { eventCategories, eventCategoryClass } from '../lib/eventCategories';
import { calendarWeekSegments, isContinuousMultiDayEvent } from '../lib/calendarLayout';
import { eventDates } from '../lib/eventRecurrence';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const iso = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const localDate = value => new Date(`${value}T12:00:00`);

export default function EventsCalendar({ events }) {
  const now = new Date();
  const [cursor, setCursor] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(null);
  const byDate = useMemo(() => events.reduce((dates, event) => {
    for (const date of eventDates(event)) (dates[date] ||= []).push(event);
    return dates;
  }, {}), [events]);
  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const days = Array(new Date(year, month, 1).getDay()).fill(null);
    for (let day = 1; day <= new Date(year, month + 1, 0).getDate(); day += 1) days.push(new Date(year, month, day));
    while (days.length % 7) days.push(null);
    return days;
  }, [cursor]);
  const weeks = useMemo(() => Array.from({ length: cells.length / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7)), [cells]);
  const selectedEvents = selectedDate ? (byDate[selectedDate] || []) : [];
  const select = date => {
    const value = iso(date);
    setSelectedDate(current=>current===value?null:value);
  };
  const changeMonth = offset => {
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + offset, 1));
    setSelectedDate(null);
  };

  return <div className={`events-calendar-layout${selectedDate ? ' has-selection' : ''}`}>
    <div className="events-calendar-card">
      <div className="events-calendar-month"><button type="button" aria-label="Previous month" onClick={() => changeMonth(-1)}>←</button><div><span>Monthly view</span><h3>{cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3></div><button type="button" aria-label="Next month" onClick={() => changeMonth(1)}>→</button></div>
      <div className="events-calendar-scroll" tabIndex="0" aria-label="Scrollable monthly event calendar">
        <div className="events-calendar-grid" role="grid" aria-label={cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}>
          <div className="events-calendar-weekdays" role="row">{DAYS.map(day => <div className="events-weekday" role="columnheader" key={day}>{day}</div>)}</div>
          {weeks.map((week, weekIndex) => {
            const weekDates = week.map(date => date ? iso(date) : null);
            const segments = calendarWeekSegments(weekDates, events);
            const laneCount = segments.length ? Math.max(...segments.map(segment => segment.lane)) + 1 : 0;
            const compactLanes = laneCount >= 4;
            const laneHeight = compactLanes ? 18 : 20;
            const laneGap = compactLanes ? 3 : 4;
            return <div className="events-calendar-week" role="row" style={{ '--range-lane-height': `${laneHeight}px`, '--range-lane-gap': `${laneGap}px`, '--range-space': `${laneCount ? laneCount * laneHeight + Math.max(0, laneCount - 1) * laneGap + 6 : 0}px` }} key={`week-${weekIndex}`}>
              <div className="events-week-cells" role="presentation">
                {week.map((date, dayIndex) => date
                  ? (() => {
                    const dateValue = iso(date);
                    const ordinaryEvents = (byDate[dateValue] || []).filter(event => !isContinuousMultiDayEvent(event));
                    return <button type="button" className={`events-day${dateValue === iso(now) ? ' is-today' : ''}${selectedDate === dateValue ? ' is-selected' : ''}${byDate[dateValue]?.length ? ' has-events' : ''}`} role="gridcell" aria-label={`${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}${byDate[dateValue]?.length ? `, ${byDate[dateValue].length} events` : ', no events'}`} aria-pressed={selectedDate === dateValue} onClick={() => select(date)} key={dateValue}><span>{date.getDate()}</span><div className="events-day-items">{ordinaryEvents.slice(0, 2).map(event => <i className={`${eventCategoryClass(event)}${event.recurrence_type === 'weekly' ? ' is-recurring' : ''}`} key={event.occurrence_key || event.id}>{event.recurrence_type === 'weekly' && <span aria-hidden="true">↻ </span>}{event.title}</i>)}{ordinaryEvents.length > 2 && <small>+{ordinaryEvents.length - 2} more</small>}</div></button>;
                  })()
                  : <div className="events-day is-blank" role="gridcell" aria-hidden="true" key={`blank-${weekIndex}-${dayIndex}`} />)}
              </div>
              {segments.length > 0 && <div className="events-week-spans" role="presentation">
                {segments.map(({ event, startColumn, endColumn, lane, continuesBefore, continuesAfter }) => <Link
                  className={`${eventCategoryClass(event)}${continuesBefore ? ' continues-before' : ''}${continuesAfter ? ' continues-after' : ''}`}
                  href={`/events/${event.id}`}
                  key={`${event.occurrence_key || event.id}:${weekIndex}`}
                  style={{ gridColumn: `${startColumn} / ${endColumn}`, gridRow: lane + 1 }}
                  aria-label={`${event.title}, ${localDate(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} through ${localDate(event.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                ><strong>{event.title}</strong><span>{localDate(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}–{localDate(event.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></Link>)}
              </div>}
            </div>;
          })}
        </div>
      </div>
    </div>
    <aside className="events-selected-panel" aria-live="polite">
      {selectedDate ? <>
        <header><span>Selected date</span><h3>{localDate(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h3><p>{selectedEvents.length} {selectedEvents.length === 1 ? 'event' : 'events'}</p></header>
        {selectedEvents.length
          ? <div className="events-selected-list">{selectedEvents.map(event => <Link href={`/events/${event.id}${event.recurrence_type === 'weekly' ? `?date=${event.date}` : ''}`} key={event.occurrence_key || event.id}><div className={`events-selected-category ${eventCategoryClass(event)}`}>{eventCategories(event).join(' · ')}</div><h4>{event.title}</h4><p>{event.org}</p>{event.time && <small>{event.time}</small>}{event.location && <small>{event.location}</small>}<b>View Event <span aria-hidden="true">→</span></b></Link>)}</div>
          : <div className="events-selected-empty"><strong>No events scheduled for this day.</strong><p>Choose another date or browse the full event list.</p></div>}
        <Link className="events-selected-all" href={`/events/all?date=${selectedDate}`}>View all events on {localDate(selectedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} <span aria-hidden="true">→</span></Link>
      </> : <div className="events-select-prompt"><span aria-hidden="true">◇</span><h3>Select a date</h3><p>Choose any day to see its engineering and campus events.</p></div>}
    </aside>
  </div>;
}
