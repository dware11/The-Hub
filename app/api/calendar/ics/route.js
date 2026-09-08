import { calendarRange } from '../../../../lib/calendarLinks';

const MAX = 4000;

function clean(value, fallback = '') {
  return String(value || '').replace(/[\r\n]/g, ' ').trim().slice(0, MAX);
}

function icsEscape(value) {
  return String(value || '').slice(0, MAX).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');
}

function safeFilename(value) {
  const name = clean(value, 'calendar-event').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 64);
  return `${name || 'calendar-event'}.ics`;
}

function utcStamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function GET(request) {
  const { searchParams } = new URL(request.url);
  const item = Object.fromEntries(['id', 'title', 'date', 'endDate', 'time', 'location', 'description', 'url', 'kind'].map((key) => [key, key === 'description' ? String(searchParams.get(key) || '').slice(0, MAX) : clean(searchParams.get(key))]));
  if (!item.title || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)) {
    return new Response('A valid title and date are required.', { status: 400 });
  }

  const range = calendarRange(item.date, item.endDate || undefined, item.time);
  const uid = `${clean(item.id, 'event')}-${item.date}@code-engineering-hub`;
  const description = [item.description, item.url ? `Source: ${item.url}` : ''].filter(Boolean).join('\n\n');
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//C.O.D.E. Engineering Hub//Calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:${icsEscape(uid)}`, `DTSTAMP:${utcStamp()}`, `SUMMARY:${icsEscape(item.title)}`,
    range.allDay ? `DTSTART;VALUE=DATE:${range.startDate.replace(/-/g, '')}` : `DTSTART:${range.startDate.replace(/[-:]/g, '')}`,
    range.allDay ? `DTEND;VALUE=DATE:${range.endDate.replace(/-/g, '')}` : `DTEND:${range.endDate.replace(/[-:]/g, '')}`,
    item.location ? `LOCATION:${icsEscape(item.location)}` : null,
    description ? `DESCRIPTION:${icsEscape(description)}` : null,
    item.url ? `URL:${icsEscape(item.url)}` : null,
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean).join('\r\n') + '\r\n';

  return new Response(lines, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="${safeFilename(item.title)}"`,
      'Cache-Control': 'no-store',
    },
  });
}
