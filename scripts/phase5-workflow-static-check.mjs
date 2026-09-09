import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expandRecurringEvents, eventDates, eventOccursOnDate } from '../lib/eventRecurrence.js';

const read = path => readFileSync(resolve(process.cwd(), path), 'utf8');
const migration = read('supabase/migrations/20260909042638_phase5_workflow_repairs.sql');
const adminData = read('lib/adminData.js');

for (const required of [
  "set status=''needs_correction''",
  "status='needs_correction'",
  "set status=''resubmitted''",
  "current_status not in ('pending','resubmitted')",
  'Only the original submitter may resubmit content',
  'possible_duplicate := candidate is not null',
  "when 'events' then 'registration_link'",
  "when 'opportunities' then 'link'",
]) assert.ok(migration.includes(required), `Missing Phase 5 workflow behavior: ${required}`);

assert.ok(adminData.includes(".in('status', ['pending', 'resubmitted'])"), 'Review queue must include resubmissions');
assert.doesNotMatch(migration, /grant\s+update\s+on\s+public\.(opportunities|events|announcements)/i, 'Do not grant table-wide contributor UPDATE');

const event = {
  id: 'weekly-workshop',
  title: 'Graduating Senior Job Search Workshops',
  date: '2026-10-02',
  time: '10:00 AM–12:00 PM',
  recurrence_type: 'weekly',
  recurrence_weekday: 5,
  recurrence_start_date: '2026-10-02',
  recurrence_end_date: '2026-11-20',
  recurrence_start_time: '10:00:00',
  recurrence_end_time: '12:00:00',
};
const occurrences = expandRecurringEvents([event]);
assert.equal(occurrences.length, 8);
assert.equal(occurrences[0].date, '2026-10-02');
assert.equal(occurrences.at(-1).date, '2026-11-20');
assert.equal(new Set(occurrences.map(item => item.id)).size, 1, 'Occurrences retain one logical event identity');
assert.equal(new Set(occurrences.map(item => item.occurrence_key)).size, 8, 'Display occurrences have stable unique keys');

const homecoming = { id: 'homecoming-week', date: '2026-10-11', end_date: '2026-10-17' };
assert.deepEqual(eventDates(homecoming), ['2026-10-11','2026-10-12','2026-10-13','2026-10-14','2026-10-15','2026-10-16','2026-10-17']);
assert.equal(eventOccursOnDate(homecoming, '2026-10-12'), true);
assert.equal(eventOccursOnDate(homecoming, '2026-10-18'), false);

console.log('Phase 5 workflow static checks passed: lifecycle, least-privilege edits, duplicates, admin links, and 8 weekly occurrences.');
