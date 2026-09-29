import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const adminData = read('lib/adminData.js');
const queue = read('app/admin/review/ReviewQueue.js');
const detail = read('app/admin/review/[type]/[id]/ReviewSubmission.js');
const reviewPage = read('app/admin/review/page.js');
const detailPage = read('app/admin/review/[type]/[id]/page.js');
const editForms = read('app/admin/content/ContentEditForms.js');
const contentPage = read('app/admin/content/page.js');
const contentManager = read('app/admin/content/ContentManager.js');
const auditData = read('lib/auditData.js');

assert.match(adminData, /getPendingQueue\(\{ includeTechnical = false \} = \{\}\)/);
assert.match(adminData, /const suggestionFields = includeTechnical[\s\S]*provider, parser_version, confidence/);
assert.match(adminData, /evidence\.diagnostics =/);
assert.match(adminData, /field_name !== 'submission_acknowledgment'/);
assert.match(reviewPage, /getPendingQueue\(\{ includeTechnical: showTechnical \}\)/);
assert.match(reviewPage, /viewerRoleId=\{viewer\.role\.id\}/);
assert.match(detailPage, /getPendingQueue\(\{ includeTechnical: showTechnical \}\)/);

for (const source of [queue, detail]) {
  assert.match(source, /Source evidence|Submission details &amp; source/);
  assert.match(source, /Details to confirm/);
  assert.match(source, /Technical diagnostics/);
}
assert.doesNotMatch(queue, /Private source evidence &amp; extraction/);
assert.doesNotMatch(queue, /pasted_text: processed/);
assert.match(queue, /suggestion\.label/);
assert.match(detail, /suggestion\.label/);
assert.match(adminData, /submitted_by:user_roles![^(]+\(id, full_name, email, org\)/);
assert.match(queue, /Another reviewer must review this submission\./);
assert.match(queue, /item\.submitted_by\?\.id === viewerRoleId/);
assert.match(queue, /onClick=\{\(\)=>decide\(reviewItem\.type,reviewItem\.key,reviewItem\.item,'approve'\)\}/);
assert.match(queue, /aria-live="assertive">\{message\}/);

assert.match(auditData, /getContentEditAudit/);
assert.match(auditData, /content_edit/);
assert.match(contentPage, /auditEdits=\{auditEdits\}/);
for (const status of ['pending', 'resubmitted', 'needs_correction', 'published', 'rejected', 'unpublished', 'archived', 'deleted']) {
  assert.match(contentPage, new RegExp(`['"]${status}['"]`));
}
assert.match(contentPage, /submitted_by_user:user_roles!/);
assert.match(contentManager, /Pending Review/);
assert.match(contentManager, /Needs Correction/);
assert.match(contentManager, /Review closed · history preserved/);
assert.match(contentManager, /Open in Review Queue/);
assert.match(editForms, /View changes/);
assert.match(editForms, /Open full edit form/);
assert.match(editForms, /Not recorded in this legacy audit event/);
assert.match(editForms, /openForm === key/);
assert.doesNotMatch(editForms, /content-edit-grid/);

console.log('Reviewer evidence sanitization and compact audited-edit UX checks passed.');
