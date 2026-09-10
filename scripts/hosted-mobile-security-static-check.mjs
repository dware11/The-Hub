import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const reportForm = read('components/ReportIssueForm.js');
const reportAction = read('app/report/actions.js');
const intakeAction = read('app/panther-submit/actions.js');
const intakeForm = read('components/PantherSubmitForm.js');
const adminData = read('lib/adminData.js');
const announcements = read('components/AnnouncementsBrowser.js');
const config = read('next.config.js');
const css = read('app/globals.css');
const migration = read('supabase/migrations/20260910021330_hosted_mobile_security_hardening.sql');

assert.match(reportForm, /const formElement = event\.currentTarget/);
assert.match(reportForm, /finally \{\s*setBusy\(false\)/);
assert.match(reportForm, /Your email/);
assert.match(reportForm, /disabled=\{busy\}/);
assert.match(reportForm, /useEffect\(\(\) => \{[\s\S]*setOpen\(false\)/);
assert.match(reportAction, /consumeRateLimit\('issue-report'/);
assert.match(intakeAction, /consumeRateLimit\('intake-session'/);
assert.match(intakeAction, /const actualBytes = file\.size/);
assert.match(intakeAction, /MAX_IMAGE_PIXELS/);
assert.match(intakeAction, /\.remove\(\[source\.storage_path\]\)/);
assert.match(intakeForm, /OCR is currently being improved/);
assert.match(intakeForm, /abandonIntakeAction/);
assert.match(adminData, /user_roles!opportunities_submitted_by_fkey/);
assert.match(adminData, /user_roles!events_submitted_by_fkey/);
assert.match(adminData, /user_roles!announcements_submitted_by_fkey/);
assert.match(announcements, /No announcements right now/);
assert.match(css, /opportunity-filter-toolbar \.page-search\{min-width:0;margin-bottom:0\}/);
assert.match(css, /code-about-connect a,\.code-about-linkedin\{width:44px;height:44px/);
assert.match(config, /Content-Security-Policy/);
assert.match(config, /X-Content-Type-Options/);
assert.match(config, /frame-ancestors 'none'/);
assert.match(migration, /'contributor', 'reviewer', 'admin', 'super_admin'/);
assert.match(migration, /revoke all on function public\.save_intake_parser_feedback/);

console.log('Hosted mobile/security hardening static checks passed.');
