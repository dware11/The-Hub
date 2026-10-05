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
const scopedIdentity = read('supabase/migrations/20261004130119_reviewer_submission_identity.sql');

assert.match(adminData, /export async function getPendingQueue\(\)/);
assert.doesNotMatch(adminData, /includeTechnical|provider, parser_version, confidence|evidence\.diagnostics/);
assert.match(adminData, /field_name !== 'submission_acknowledgment'/);
assert.match(reviewPage, /getPendingQueue\(\)/);
assert.match(reviewPage, /<ReviewQueue queue=\{queue\}/);
assert.match(detailPage, /getPendingQueue\(\)/);
assert.doesNotMatch(detailPage, /showTechnical|isSuperAdmin/);

for (const source of [queue, detail]) {
  assert.match(source, /Source evidence|Submission details &amp; source|Start with the source/);
  assert.match(source, /Details to confirm/);
}
assert.doesNotMatch(queue, /Technical diagnostics|provider unavailable|parser unavailable|confidence/);
assert.doesNotMatch(detail, /Technical diagnostics/);
assert.doesNotMatch(queue, /Private source evidence &amp; extraction/);
assert.doesNotMatch(queue, /pasted_text: processed/);
assert.match(queue, /suggestion\.label/);
assert.match(detail, /suggestion\.label/);
assert.match(adminData, /submitted_by:user_roles![^(]+\(full_name, email, org\)/);
assert.match(adminData, /get_review_submission_identity/);
assert.match(scopedIdentity, /role in \('reviewer', 'admin', 'super_admin'\)/);
assert.match(scopedIdentity, /submission_status not in \('pending', 'resubmitted'\)/);
assert.match(scopedIdentity, /revoke all on function public\.get_review_submission_identity\(text, uuid\) from public/);
assert.match(scopedIdentity, /grant execute on function public\.get_review_submission_identity\(text, uuid\) to authenticated/);
assert.match(queue, /Another reviewer must review this submission\./);
assert.match(queue, /item\.own_submission/);
assert.match(queue, /href=\{`\/admin\/review\/\$\{type\}\/\$\{item\.id\}`\}/);
assert.match(queue, /Review submission/);
assert.doesNotMatch(queue, /Verify &amp; decide/);

assert.match(auditData, /getContentEditAudit/);
assert.match(auditData, /content_edit/);
assert.match(contentPage, /auditEdits=\{auditEdits\}/);
for (const status of ['pending', 'resubmitted', 'needs_correction', 'published', 'rejected', 'unpublished', 'archived', 'deleted', 'expired_before_review']) {
  assert.match(contentPage, new RegExp(`['"]${status}['"]`));
}
assert.match(contentPage, /submitted_by_user:user_roles!/);
assert.match(contentManager, /Pending Review/);
assert.match(contentManager, /Needs Correction/);
assert.match(contentManager, /Review closed · history preserved/);
assert.match(contentManager, /Open in Review Queue/);
assert.match(editForms, /View changes/);
assert.match(editForms, /Open full edit form/);
assert.match(read('app/admin/content/actions.js'), /manage_published_content/);
assert.match(read('app/admin/content/actions.js'), /manage_announcement_editorial/);
assert.match(read('app/admin/content/actions.js'), /`\$\{publicBase\}\/\$\{id\}`/);
assert.match(contentManager, /row\.status !== 'deleted'.*Move to trash/);
assert.match(editForms, /Not recorded in this legacy audit event/);
assert.match(editForms, /openForm === key/);
assert.doesNotMatch(editForms, /content-edit-grid/);

console.log('Reviewer evidence sanitization and compact audited-edit UX checks passed.');
