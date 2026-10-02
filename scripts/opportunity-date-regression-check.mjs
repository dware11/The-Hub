import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  addCalendarDays,
  getHubBusinessDate,
  isActiveOpportunity,
  isOpportunityInDigest,
} from '../lib/dateFilters.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataSource = fs.readFileSync(path.join(root, 'lib/data.js'), 'utf8');
const today = '2026-09-30';

assert.equal(isActiveOpportunity({ deadline_type: 'specific_date', deadline: today }, today), true, 'deadline today must remain active');
assert.equal(isActiveOpportunity({ deadline_type: 'specific_date', deadline: '2026-09-29' }, today), false, 'deadline yesterday must be inactive');
assert.equal(isActiveOpportunity({ deadline_type: 'specific_date', deadline: '2026-10-01' }, today), true, 'future deadline must remain active');

assert.equal(isOpportunityInDigest({ deadline: '2026-09-29' }, today), false, 'expired deadline must be excluded from digest');
assert.equal(isOpportunityInDigest({ deadline: today }, today), true, 'deadline today must be included in digest');
assert.equal(isOpportunityInDigest({ deadline: addCalendarDays(today, 21) }, today), true, 'deadline exactly 21 days away must be included');
assert.equal(isOpportunityInDigest({ deadline: addCalendarDays(today, 22) }, today), false, 'deadline 22 days away must be excluded');

const chicagoEveningAfterUtcMidnight = new Date('2026-10-01T04:30:00.000Z');
assert.equal(getHubBusinessDate(chicagoEveningAfterUtcMidnight), today, 'Central evening must remain September 30 after UTC advances');
assert.equal(isActiveOpportunity({ deadline: today }, getHubBusinessDate(chicagoEveningAfterUtcMidnight)), true, 'September 30 deadline must remain active through Central evening');
assert.equal(isActiveOpportunity({ deadline: today }, '2026-10-01'), false, 'September 30 deadline must become inactive October 1 Central');

const applyAsap = { deadline_type: 'rolling', deadline: null, posted_date: '2026-09-20' };
assert.equal(isActiveOpportunity(applyAsap, today), true, 'Apply ASAP opportunity must remain active without a fabricated deadline');
assert.equal(isOpportunityInDigest(applyAsap, today), false, 'Apply ASAP must not enter the dated-deadline digest window');
assert.equal(applyAsap.deadline, null, 'Apply ASAP deadline must remain null');

assert.match(dataSource, /\.or\(`and\(deadline_type\.eq\.specific_date,deadline\.gte\.\$\{today\}\),deadline_type\.neq\.specific_date`\)/, 'public opportunity queries must enforce the active deadline boundary without expiring Apply ASAP rows');
assert.match(dataSource, /\.gte\('deadline', today\)[\s\S]*\.lte\('deadline', in21Days\)/, 'digest query must enforce both deadline bounds');
assert.doesNotMatch(dataSource, /Date\.now\(\) \+ 21/, 'digest must not calculate its date window from UTC milliseconds');

console.log('Opportunity business-date regressions passed for active visibility, digest windows, Central Time, and Apply ASAP.');
