'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient, isDemoMode } from '../../lib/supabaseServerClient';
import { notifyIssueReport } from '../../lib/notifications';
import { getViewer, isAdmin } from '../../lib/auth';

const CONTENT_ISSUES = new Set(['Broken link', 'Wrong date/deadline', 'Wrong information', 'Duplicate', 'Event canceled/changed', 'Other']);
const SITE_ISSUES = new Set(['Sign-in issue', 'Submission issue', 'Calendar/display issue', 'Page error', 'Accessibility issue', 'Other']);

function clean(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export async function createIssueReport(input) {
  const contentType = ['opportunity', 'event'].includes(input?.contentType) ? input.contentType : null;
  const contentId = contentType && /^[0-9a-f-]{36}$/i.test(input?.contentId || '') ? input.contentId : null;
  const allowed = contentType ? CONTENT_ISSUES : SITE_ISSUES;
  const issueType = clean(input?.issueType, 80);
  const description = clean(input?.description, 3000);
  const reporterEmail = clean(input?.reporterEmail, 320).toLowerCase() || null;
  const pageUrl = clean(input?.pageUrl, 2048) || '/';

  if (!allowed.has(issueType)) return { ok: false, error: 'Choose a valid issue type.' };
  if (!description) return { ok: false, error: 'Describe the problem.' };
  if (reporterEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reporterEmail)) return { ok: false, error: 'Enter a valid email address or leave it blank.' };
  if (!(pageUrl.startsWith('/') || /^https?:\/\//i.test(pageUrl))) return { ok: false, error: 'The reported page address is invalid.' };
  if (contentType && !contentId) return { ok: false, error: 'The content reference is invalid.' };

  if (isDemoMode) return { ok: true, demo: true };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from('issue_reports').insert({
    issue_type: issueType,
    content_type: contentType,
    content_id: contentId,
    page_url: pageUrl,
    description,
    reporter_email: reporterEmail,
  });
  if (error) return { ok: false, error: 'The report could not be saved. Please try again.' };

  void notifyIssueReport(issueType).then(result => {
    if (!result.ok && !result.disabled) console.error('Issue-report notification could not be delivered.');
  });
  return { ok: true };
}

export async function updateIssueStatus(id, status) {
  if (!['in_review', 'resolved'].includes(status)) return { ok: false, error: 'Invalid issue status.' };
  if (isDemoMode) return { ok: true, demo: true };
  const viewer = await getViewer();
  if (!viewer.user || !isAdmin(viewer)) return { ok: false, error: 'Administrator access required.' };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from('issue_reports').update({
    status,
    resolved_at: status === 'resolved' ? new Date().toISOString() : null,
  }).eq('id', id);
  if (error) return { ok: false, error: 'The issue status could not be updated.' };
  revalidatePath('/admin/issues');
  return { ok: true };
}
