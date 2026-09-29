import fs from 'node:fs';
import assert from 'node:assert/strict';
import { calendarWeekSegments, isContinuousMultiDayEvent } from '../lib/calendarLayout.js';
import { expandRecurringEvents, recurringOccurrence } from '../lib/eventRecurrence.js';

const route = fs.readFileSync('app/api/calendar/ics/route.js', 'utf8');
const links = fs.readFileSync('lib/calendarLinks.js', 'utf8');
const actions = fs.readFileSync('components/CalendarActions.js', 'utf8');
const eventDetail = fs.readFileSync('app/events/[id]/page.js', 'utf8');
const calendar = fs.readFileSync('components/EventsCalendar.js', 'utf8');
const eventList = fs.readFileSync('components/EventsAllBrowser.js', 'utf8');
const recurrence = fs.readFileSync('lib/eventRecurrence.js', 'utf8');
const styles = fs.readFileSync('app/globals.css', 'utf8');

assert.match(links, /apple:\s*buildAppleCalendarUrl/);
assert.match(actions, /Open in Apple Calendar/);
assert.match(actions, /calendarUrls\.apple/);
assert.match(route, /Content-Type.*text\/calendar/);
assert.match(route, /Content-Disposition.*inline/);
assert.match(route, /\.filter\(Boolean\)\.join\(/);
assert.ok(route.includes("replace(/\\\\/g"));
assert.match(route, /DTSTART;VALUE=DATE/);
assert.match(route, /DTEND;VALUE=DATE/);
assert.match(route, /DTSTART;TZID=America\/Chicago/);
assert.match(links, /ctz: 'America\/Chicago'/);
assert.match(links, /timezone: 'America\/Chicago'/);
assert.match(route, /URL:/);
assert.match(route, /safeFilename/);
assert.match(route, /status: 400/);
assert.match(eventDetail, /recurringOccurrence/);
assert.match(calendar, /recurrence_type === 'weekly'/);
assert.match(eventList, /recurrence_type === 'weekly'/);
assert.match(recurrence, /requested < start \|\| requested > end/);
const recurringFixture = {
  id: 'weekly-test', date: '2026-10-02', time: '10:00 AM-12:00 PM',
  recurrence_type: 'weekly', recurrence_start_date: '2026-10-02', recurrence_end_date: '2026-10-16',
  recurrence_start_time: '10:00:00', recurrence_end_time: '12:00:00',
};
assert.equal(expandRecurringEvents([recurringFixture])[1].time, '10:00 AM-12:00 PM');
assert.equal(expandRecurringEvents([{ ...recurringFixture, end_date: '2026-10-16' }])[1].end_date, null);
assert.equal(recurringOccurrence(recurringFixture, '2026-10-09').date, '2026-10-09');
assert.equal(recurringOccurrence(recurringFixture, '2026-10-08').date, '2026-10-02');
assert.equal(isContinuousMultiDayEvent(recurringFixture), false);

const weekDates = ['2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17'];
const rangeFixture = { id: 'range-test', title: 'Homecoming Week', date: '2026-10-11', end_date: '2026-10-17' };
const overlappingFixture = { id: 'exam-test', title: 'Mid-Semester Exams', date: '2026-10-13', end_date: '2026-10-17' };
const segments = calendarWeekSegments(weekDates, [rangeFixture, overlappingFixture]);
assert.deepEqual([segments[0].startColumn, segments[0].endColumn, segments[0].lane], [1, 8, 0]);
assert.deepEqual([segments[1].startColumn, segments[1].endColumn, segments[1].lane], [3, 8, 1]);
assert.equal(calendarWeekSegments(weekDates, [{ ...rangeFixture, date: '2026-10-10', end_date: '2026-10-13' }])[0].continuesBefore, true);
const septemberOpeningWeek = [null, null, '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'];
const septemberBoundaryRanges = calendarWeekSegments(septemberOpeningWeek, [
  { id: 'graduate-late-registration', title: 'Graduate and Doctoral Late Registration Begins', date: '2026-08-24', end_date: '2026-09-01' },
  { id: 'attendance-reporting', title: 'Attendance Reporting Period Begins', date: '2026-08-24', end_date: '2026-09-02' },
]);
assert.deepEqual(septemberBoundaryRanges.map(({ startColumn, endColumn, lane, continuesBefore }) => [startColumn, endColumn, lane, continuesBefore]), [[3, 4, 0, true], [3, 5, 1, true]]);
assert.match(calendar, /calendarWeekSegments/);
assert.match(calendar, /events-week-spans/);
assert.doesNotMatch(calendar, /events-range-strip/);
assert.match(styles, /events-calendar-week \.events-day > span[\s\S]*position:\s*absolute/);
assert.match(styles, /events-calendar-week \.events-week-spans[\s\S]*top:\s*36px/);
assert.match(styles, /margin-top:\s*calc\(31px \+ var\(--range-space, 0px\)\)/);
console.log('Calendar ICS static checks passed.');
