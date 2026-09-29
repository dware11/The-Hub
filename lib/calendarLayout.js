function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

export function isContinuousMultiDayEvent(event) {
  return event?.recurrence_type !== 'weekly'
    && validDate(event?.date)
    && validDate(event?.end_date)
    && event.end_date > event.date;
}

export function calendarWeekSegments(weekDates, events) {
  const visibleDates = weekDates.filter(Boolean);
  if (!visibleDates.length) return [];

  const weekStart = visibleDates[0];
  const weekEnd = visibleDates.at(-1);
  const segments = events
    .filter(isContinuousMultiDayEvent)
    .filter(event => event.date <= weekEnd && event.end_date >= weekStart)
    .map(event => {
      const visibleStart = event.date < weekStart ? weekStart : event.date;
      const visibleEnd = event.end_date > weekEnd ? weekEnd : event.end_date;
      const startIndex = weekDates.findIndex(date => date === visibleStart);
      const endIndex = weekDates.findLastIndex(date => date === visibleEnd);
      return {
        event,
        startColumn: startIndex + 1,
        endColumn: endIndex + 2,
        continuesBefore: event.date < visibleStart,
        continuesAfter: event.end_date > visibleEnd,
      };
    })
    .filter(segment => segment.startColumn > 0 && segment.endColumn > segment.startColumn)
    .sort((a, b) => a.startColumn - b.startColumn || a.endColumn - b.endColumn || a.event.title.localeCompare(b.event.title));

  const laneEnds = [];
  return segments.map(segment => {
    let lane = laneEnds.findIndex(endColumn => segment.startColumn >= endColumn);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = segment.endColumn;
    return { ...segment, lane };
  });
}
