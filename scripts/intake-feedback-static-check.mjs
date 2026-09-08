import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const legacyPage = read('app/submit/page.js');
const legacyAction = read('app/submit/actions.js');
const migration = read('supabase/migrations/202609020002_parser_feedback_and_review_evidence.sql');
const submitForm = read('components/PantherSubmitForm.js');
const review = read('app/admin/review/ReviewQueue.js') + read('lib/adminData.js');

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
assert.match(submitForm, /Optional: how accurate were the suggestions/);
assert.match(submitForm, /Your submission is still complete/);
assert.match(submitForm, /if \(!artifacts\.length && !pastedText\.trim\(\)\)[\s\S]{0,180}setStep\(4\)/);
assert.match(review, /Private source evidence/);
assert.match(review, /createSignedUrl\(artifact\.storage_path, 600\)/);
console.log('Intake checks passed: legacy redirect, private reviewer evidence, and owner-bound optional parser feedback.');
