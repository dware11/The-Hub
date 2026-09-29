import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const legacyPage = read('app/submit/page.js');
const legacyAction = read('app/submit/actions.js');
const migration = read('supabase/migrations/202609020002_parser_feedback_and_review_evidence.sql');
const submitForm = read('components/PantherSubmitForm.js');
const parserData = read('lib/parserFeedbackData.js');
const systemInsights = read('app/admin/system/page.js');
const parserActivityPanel = read('components/ParserActivityPanel.js');
const review = read('app/admin/review/ReviewQueue.js') + read('lib/adminData.js');
const currentFeedbackMigration = read('supabase/migrations/20260928134549_submission_clarity_and_super_admin_parser_feedback.sql');
const actions = read('app/panther-submit/actions.js');

assert.match(legacyPage, /redirect\('\/panther-submit\?from=legacy-submit'\)/);
assert.doesNotMatch(legacyPage, /SubmitForm|uploadFlyer/);
assert.match(legacyAction, /submission path has been retired/i);
for (const control of [
  'create table public.intake_parser_feedback',
  'save_intake_parser_feedback',
  'get_parser_feedback_metrics',
  'owners and reviewers read parser feedback',
  "role in ('contributor', 'reviewer', 'admin')",
  "state = 'submitted'",
]) assert.ok(migration.includes(control), `Missing feedback control: ${control}`);
for (const prohibited of ['ip_address', 'user_agent', 'device_id', 'email_address', 'corrected_value', 'raw_text']) {
  assert.doesNotMatch(migration, new RegExp(`\\n\\s*${prohibited}\\s+`, 'i'), `Prohibited feedback column: ${prohibited}`);
}
assert.match(submitForm, /Optional: parser quality feedback/);
assert.doesNotMatch(submitForm, /View technical details/);
assert.match(actions, /isSuperAdmin\(viewer\)/);
assert.match(currentFeedbackMigration, /role = 'super_admin'/);
assert.match(currentFeedbackMigration, /super admins read parser feedback/);
assert.match(parserData, /getParserActivity/);
for (const table of ['intake_sessions', 'source_artifacts', 'field_suggestions', 'intake_parser_feedback']) assert.ok(parserData.includes(`.from('${table}')`), `Parser activity is missing ${table} evidence.`);
assert.doesNotMatch(parserData, /source_text/);
assert.match(systemInsights, /<ParserActivityPanel activities=\{parserActivity\}/);
for (const copy of ['View parser activity', 'Recent extraction attempts', 'Extraction failed', 'Incomplete workflow', 'No parser feedback was submitted']) assert.ok(parserActivityPanel.includes(copy), `System Insights parser review is missing: ${copy}`);
for (const filter of ['Outcome', 'Content', 'Source', 'Feedback']) assert.ok(parserActivityPanel.includes(`<span>${filter}</span>`), `Parser activity filter is missing: ${filter}`);
assert.match(submitForm, /Your submission is still complete/);
assert.match(submitForm, /if \(!artifacts\.length && !pastedText\.trim\(\)\)[\s\S]{0,180}setStep\(3\)/);
assert.match(review, /Submission details &amp; source/);
assert.match(review, /createSignedUrl\(artifact\.storage_path, 600\)/);
console.log('Intake checks passed: legacy redirect, private reviewer evidence, and super-admin-only parser feedback.');
