import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = path => readFileSync(resolve(process.cwd(), path), 'utf8');
const gate = read('components/SubmissionGate.js');
const access = read('components/AccessRequestForm.js');
const accessAction = read('app/access/actions.js');
const accessData = read('lib/accessData.js');
const committeeData = read('lib/committeeData.js');
const committeePage = read('app/admin/committee/page.js');
const committeeQueue = read('app/admin/committee/CommitteeQueue.js');
const nav = read('components/Nav.js');
const desktopNav = read('components/DesktopNavMenus.js');
const profile = read('components/WorkspaceIdentityForm.js');
const form = read('components/PantherSubmitForm.js');
const action = read('app/panther-submit/actions.js');
const validation = read('lib/validation.js');
const report = read('components/ReportIssueForm.js');
const footer = read('components/SiteFooter.js');
const eventPage = read('app/events/[id]/page.js');
const opportunityPage = read('app/opportunities/[id]/page.js');
const reportAction = read('app/report/actions.js');
const calendar = read('components/EventsCalendar.js');
const recurrence = read('lib/eventRecurrence.js');
const rbac = read('supabase/migrations/20260823_launch_rbac_alignment.sql');
const selfReview = read('supabase/migrations/20260908184025_prevent_reviewer_self_review.sql');

// Auth and identity states.
assert.match(gate, /if \(!viewer\.user\)/);
assert.match(gate, /if \(!canSubmit\(viewer\)\)/);
assert.match(gate, /getMyPendingAccessRequest\(viewer\.user\.id\)/);
assert.match(gate, /<PantherSubmitForm/);
assert.match(desktopNav, /label="Workspace" href="\/workspace"/);
assert.match(desktopNav, /\{contributor && <Link href="\/panther-submit"/);
assert.match(nav, /next="\/workspace"/);
assert.match(profile, /Complete your Hub profile/);
assert.match(form, /Name not added yet/);

// Access request lifecycle and identity binding.
assert.match(access, /Contributor access request pending/);
assert.match(access, /Update request details/);
assert.match(access, /does not grant a Hub role/);
assert.match(accessData, /\.eq\('auth_user_id', authUserId\)/);
assert.match(accessData, /\.eq\('status', 'pending'\)/);
assert.match(accessAction, /request_contributor_access/);
assert.match(rbac, /role in \('contributor','reviewer','admin'\)/);
assert.match(committeeData, /getPendingAccessRequests[\s\S]*\.eq\('status','pending'\)/);
assert.match(committeePage, /getPendingAccessRequests\(\)/);
assert.match(committeeQueue, /requests\.filter\(request=>request\.status==='pending'\)/);

// Event submission: required host, optional contact/location, acknowledgment, evidence, lifecycle.
assert.match(validation, /org: text\(input\.org, 'Organization or source', \{ required: true/);
assert.match(validation, /location: text\(input\.location, 'Location', \{ max: 300 \}\) \|\| null/);
assert.doesNotMatch(validation, /required: type === 'opportunity'/);
assert.match(validation, /contact_email: email\(input\.contact_email, 'Contact email'\)/);
assert.match(form, /Before you submit/);
assert.match(action, /acknowledgmentAccepted !== true/);
assert.match(action, /intake_sessions/);
assert.match(action, /source_artifacts/);
assert.match(action, /field_suggestions/);
assert.match(action, /state: 'submitted'/);
assert.match(action, /retained: true/);
assert.match(form, /no content was submitted/i);

// Reporting is contextual, singular on content detail pages, accessible, and persists before email.
assert.match(eventPage, /Report an issue with this event/);
assert.match(opportunityPage, /Report an issue with this opportunity/);
assert.match(footer, /\^\\\/\(events\|opportunities\)[\s\S]*\.test\(pathname\)/);
assert.match(report, /contentTitle/);
assert.match(report, /aria-modal="true"/);
assert.match(report, /event\.key === 'Escape'/);
assert.match(report, /formElement\.reset\(\)/);
assert.match(reportAction, /\.from\('issue_reports'\)[\s\S]*\.insert/);
assert.match(form, /Can’t find your organization\? Request it\./);
assert.match(report, /organizationRequest/);
for (const field of ['organization_name','organization_type','organization_contact_name','organization_contact_email','organization_website']) assert.ok(report.includes(field), `organization request field missing: ${field}`);
assert.match(reportAction, /Sign in before requesting an organization addition/);
assert.match(reportAction, /reporterEmail = viewer\.user\.email/);
assert.match(reportAction, /organization_type/);

// Multi-day events remain one source record and do not replace ordinary day entries.
assert.match(calendar, /calendarWeekSegments/);
assert.match(calendar, /events-week-spans/);
assert.doesNotMatch(calendar, /events-range-strip/);
assert.match(calendar, /ordinaryEvents/);
assert.doesNotMatch(calendar, /flatMap\([\s\S]*end_date/);
assert.match(recurrence, /recurrence_type/);
assert.match(selfReview, /Reviewers cannot review or modify review evidence for their own submission/);

console.log('Auth/access/Event repair checks passed: state gates, optional Event fields, retained failures, contextual reporting, and multi-day presentation.');
