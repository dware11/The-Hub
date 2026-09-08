'use client';

import { buildCalendarUrls, calendarRange } from '../lib/calendarLinks';
import { trackEngagement } from '../lib/engagement';

const actionClass = 'block w-full text-center rounded-lg px-4 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-gold-400 focus:ring-offset-2';

export default function CalendarActions({ id, contentType = 'event', title, date, endDate, time, location, description, url, kind = 'event' }) {
  if (!date) return null;
  const item = { id, title, date, endDate, time, location, description, url, kind };
  const range = calendarRange(date, endDate, time);
  const calendarUrls = buildCalendarUrls(item, range);

  return <div className="space-y-3" aria-label="Add to calendar">
    <a href={calendarUrls.outlook} target="_blank" rel="noreferrer" onClick={() => trackEngagement({ contentType, contentId: String(id), action: 'calendar_outlook' })} className={`${actionClass} bg-purple-900 text-white hover:bg-purple-700`}>
      Open in PVAMU Outlook
    </a>
    <a href={calendarUrls.google} target="_blank" rel="noreferrer" onClick={() => trackEngagement({ contentType, contentId: String(id), action: 'calendar_google' })} className={`${actionClass} border border-purple-900 text-purple-900 hover:bg-purple-50`}>
      Open in Google Calendar
    </a>
    <a href={calendarUrls.apple} className={`${actionClass} border border-slate-300 text-slate-700 hover:bg-slate-50`}>
      Open in Apple Calendar
    </a>
    <div className="rounded-lg border border-line bg-cream/50 p-3 text-xs leading-relaxed text-slate">
      <p>Sign in if prompted, review the {kind === 'deadline' ? 'deadline details' : 'event details'}, then press <strong>Save</strong> in your calendar.</p>
      <p className="mt-1">{kind === 'deadline'
        ? 'For deadlines, consider reminders one week and one day before the due date.'
        : 'For events, consider a reminder one hour before the start time.'}</p>
      <p className="mt-1 font-medium text-purple-900">The Hub never receives access to your calendar account.</p>
    </div>
  </div>;
}
