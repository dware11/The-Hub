import fs from 'node:fs';
import assert from 'node:assert/strict';
import { expandRecurringEvents, recurringOccurrence } from '../lib/eventRecurrence.js';

const route = fs.readFileSync('app/api/calendar/ics/route.js', 'utf8');
const links = fs.readFileSync('lib/calendarLinks.js', 'utf8');
const actions = fs.readFileSync('components/CalendarActions.js', 'utf8');
const eventDetail = fs.readFileSync('app/events/[id]/page.js', 'utf8');
const calendar = fs.readFileSync('components/EventsCalendar.js', 'utf8');
const eventList = fs.readFileSync('components/EventsAllBrowser.js', 'utf8');
const recurrence = fs.readFileSync('lib/eventRecurrence.js', 'utf8');

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
assert.equal(recurringOccurrence(recurringFixture, '2026-10-09').date, '2026-10-09');
assert.equal(recurringOccurrence(recurringFixture, '2026-10-08').date, '2026-10-02');
console.log('Calendar ICS static checks passed.');
