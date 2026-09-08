function compactDate(date) {
  return date.replace(/-/g, '');
}

function addDays(date, amount) {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + amount));
  return value.toISOString().slice(0, 10);
}

function parseTimes(time) {
  return [...String(time || '').matchAll(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/gi)].map((match) => {
    let hour = Number(match[1]) % 12;
    if (match[3].toUpperCase() === 'PM') hour += 12;
    return { hour, minute: Number(match[2] || 0) };
  });
}

function localDateTime(date, time) {
  return `${date}T${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}:00`;
}

function addMinutes(localValue, minutes) {
  const [date, time] = localValue.split('T');
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day, hour, minute + minutes));
  return value.toISOString().slice(0, 19);
}

export function calendarRange(date, endDate, time) {
  const times = parseTimes(time);
  if (!times.length) {
    const exclusiveEnd = addDays(endDate || date, 1);
    return {
      allDay: true,
      startDate: date,
      endDate: exclusiveEnd,
      googleStart: compactDate(date),
      googleEnd: compactDate(exclusiveEnd),
      outlookStart: `${date}T00:00:00`,
      outlookEnd: `${exclusiveEnd}T00:00:00`,
    };
  }

  const start = localDateTime(date, times[0]);
  let end = times[1] ? localDateTime(endDate || date, times[1]) : addMinutes(start, 60);
  if (end <= start && !endDate) end = localDateTime(addDays(date, 1), times[1]);

  return {
    allDay: false,
    startDate: start,
    endDate: end,
    googleStart: start.replace(/[-:]/g, ''),
    googleEnd: end.replace(/[-:]/g, ''),
    outlookStart: start,
    outlookEnd: end,
  };
}

function descriptionWithSource(description, url) {
  return [description, url ? `Source: ${url}` : ''].filter(Boolean).join('\n\n');
}

export function buildCalendarUrls(item, range = calendarRange(item.date, item.endDate, item.time)) {
  const details = descriptionWithSource(item.description, item.url);
  const googleParams = new URLSearchParams({
    action: 'TEMPLATE',
    text: item.title,
    dates: `${range.googleStart}/${range.googleEnd}`,
    details,
    location: item.location || '',
  });
  const outlookParams = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: item.title,
    startdt: range.outlookStart,
    enddt: range.outlookEnd,
    body: details,
    location: item.location || '',
  });
  if (range.allDay) outlookParams.set('allday', 'true');

  return {
    google: `https://calendar.google.com/calendar/render?${googleParams}`,
    outlook: `https://outlook.office.com/calendar/0/deeplink/compose?${outlookParams}`,
    apple: buildAppleCalendarUrl(item),
  };
}

export function buildAppleCalendarUrl(item) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({
    id: item.id,
    title: item.title,
    date: item.date,
    endDate: item.endDate,
    time: item.time,
    location: item.location,
    description: item.description,
    url: item.url,
    kind: item.kind,
  })) {
    if (value !== undefined && value !== null && String(value).trim()) params.set(key, String(value));
  }
  return `/api/calendar/ics?${params.toString()}`;
}
