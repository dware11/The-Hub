const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function isoDate(value) {
  return value.toISOString().slice(0, 10);
}

export function eventOccursOnDate(event, date) {
  const target = parseDate(date);
  const start = parseDate(event?.date);
  const end = parseDate(event?.end_date || event?.date);
  return Boolean(target && start && end && target >= start && target <= end);
}

export function eventDates(event) {
  const start = parseDate(event?.date);
  const end = parseDate(event?.end_date || event?.date);
  if (!start || !end || end < start) return [];
  const dates = [];
  for (let cursor = start; cursor <= end; cursor = new Date(cursor.getTime() + DAY_MS)) {
    dates.push(isoDate(cursor));
  }
  return dates;
}

export function expandRecurringEvents(events) {
  return events.flatMap((event) => {
    if (event.recurrence_type !== 'weekly') return [{ ...event, occurrence_key: `${event.id}:${event.date}` }];

    const start = parseDate(event.recurrence_start_date);
    const end = parseDate(event.recurrence_end_date);
    if (!start || !end || end < start) return [{ ...event, occurrence_key: `${event.id}:${event.date}` }];

    const occurrences = [];
    for (let cursor = start; cursor <= end; cursor = new Date(cursor.getTime() + 7 * DAY_MS)) {
      const date = isoDate(cursor);
      occurrences.push({
        ...event,
        date,
        time: event.time || (event.recurrence_start_time && event.recurrence_end_time
          ? `${event.recurrence_start_time.slice(0, 5)}–${event.recurrence_end_time.slice(0, 5)}`
          : event.time),
        occurrence_key: `${event.id}:${date}`,
      });
    }
    return occurrences;
  });
}

export function recurringOccurrence(event, requestedDate) {
  if (event?.recurrence_type !== 'weekly') return event;
  const requested = parseDate(requestedDate);
  const start = parseDate(event.recurrence_start_date);
  const end = parseDate(event.recurrence_end_date);
  if (!requested || !start || !end || requested < start || requested > end) return event;
  if ((requested.getTime() - start.getTime()) % (7 * DAY_MS) !== 0) return event;
  return {
    ...event,
    date: requestedDate,
    end_date: null,
    time: event.time || (event.recurrence_start_time && event.recurrence_end_time
      ? `${event.recurrence_start_time.slice(0, 5)}–${event.recurrence_end_time.slice(0, 5)}`
      : event.time),
  };
}
