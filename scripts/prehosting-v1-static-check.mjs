import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = path => readFileSync(resolve(process.cwd(), path), 'utf8');
const form = read('components/PantherSubmitForm.js');
const intake = read('app/panther-submit/actions.js');
const review = read('app/admin/review/ReviewQueue.js');
const issues = read('app/report/actions.js');
const migration = read('supabase/migrations/20260909145833_pre_hosting_v1_multiday_reports_upload_hardening.sql');

assert.match(form, /Accepted files: PDF, PNG, JPG\/JPEG/);
assert.doesNotMatch(form, /WebP|DOCX|XLSX|PPTX/);
const sourceTypes = form.match(/const SOURCE_TYPES = \[[\s\S]*?\];/)?.[0] || '';
assert.doesNotMatch(sourceTypes, /flyer|email_screenshot|webpage_screenshot|other|source_link/);
assert.match(form, /sourceIds\[suggestion\.sourceArtifactId\]/);
assert.match(intake, /signatureMatches/);
assert.match(intake, /source_text: pastedText/);
assert.match(intake, /suggestionError/);
assert.match(review, /artifact\.source_text/);
assert.match(issues, /createIssueReport/);
assert.match(issues, /updateIssueStatus/);
assert.doesNotMatch(issues, /issue_reports'[\s\S]{0,500}\.select\('id'\)/);
assert.match(migration, /grant insert on table public\.issue_reports to anon, authenticated/);
assert.match(migration, /grant select, update on table public\.issue_reports to authenticated/);

console.log('Pre-hosting checks passed: truthful upload surface, provenance mapping, issue reporting, and least-privilege grants.');
