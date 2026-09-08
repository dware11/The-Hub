import fs from 'node:fs';
import assert from 'node:assert/strict';

const route = fs.readFileSync('app/api/calendar/ics/route.js', 'utf8');
const links = fs.readFileSync('lib/calendarLinks.js', 'utf8');
const actions = fs.readFileSync('components/CalendarActions.js', 'utf8');

assert.match(links, /apple:\s*buildAppleCalendarUrl/);
assert.match(actions, /Open in Apple Calendar/);
assert.match(actions, /calendarUrls\.apple/);
assert.match(route, /Content-Type.*text\/calendar/);
assert.match(route, /Content-Disposition.*inline/);
assert.match(route, /\.filter\(Boolean\)\.join\(/);
assert.ok(route.includes("replace(/\\\\/g"));
assert.match(route, /DTSTART;VALUE=DATE/);
assert.match(route, /DTEND;VALUE=DATE/);
assert.match(route, /URL:/);
assert.match(route, /safeFilename/);
assert.match(route, /status: 400/);
console.log('Calendar ICS static checks passed.');
