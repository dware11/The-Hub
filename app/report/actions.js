'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { after } from 'next/server';
import { createServerSupabaseClient, isDemoMode } from '../../lib/supabaseServerClient';
import { notifyIssueReport } from '../../lib/notifications';
import { getViewer, isAdmin } from '../../lib/auth';
import { consumeRateLimit, requestFingerprint } from '../../lib/rateLimit';
import { CONTENT_ISSUES, SITE_ISSUES, OPPORTUNITY_ISSUES, EVENT_ISSUES } from '../../lib/issueTypes';
import { ORGANIZATION_TYPES } from '../../lib/organizationTypes';

const CONTENT_ISSUE_SET = new Set(CONTENT_ISSUES);
const SITE_ISSUE_SET = new Set(SITE_ISSUES);

function clean(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export async function createIssueReport(input) {
  const contentType = ['opportunity', 'event'].includes(input?.contentType) ? input.contentType : null;
  const contentId = contentType && /^[0-9a-f-]{36}$/i.test(input?.contentId || '') ? input.contentId : null;
  const allowed = contentType === 'opportunity' ? new Set(OPPORTUNITY_ISSUES) : contentType === 'event' ? new Set(EVENT_ISSUES) : SITE_ISSUE_SET;
  const issueType = clean(input?.issueType, 80);
  let description = clean(input?.description, 3000);
  let reporterEmail = clean(input?.reporterEmail, 320).toLowerCase() || null;
  const pageUrl = clean(input?.pageUrl, 2048) || '/';
  const isOrganizationRequest = issueType === 'Organization addition request';
  const organizationName = clean(input?.organizationName, 160);
  const organizationType = clean(input?.organizationType, 120);
  const organizationContactName = clean(input?.organizationContactName, 160) || null;
  const organizationContactEmail = clean(input?.organizationContactEmail, 320).toLowerCase() || null;
  const organizationWebsite = clean(input?.organizationWebsite, 2000) || null;

  if (!allowed.has(issueType)) return { ok: false, error: 'Choose a valid issue type.' };
  const viewer = await getViewer();
  if (viewer.user?.email) reporterEmail = viewer.user.email.trim().toLowerCase();
  if (isOrganizationRequest) {
    if (!viewer.user?.email) return { ok: false, error: 'Sign in before requesting an organization addition.' };
    reporterEmail = viewer.user.email.trim().toLowerCase();
    if (!organizationName) return { ok: false, error: 'Enter the organization’s full name.' };
    if (!ORGANIZATION_TYPES.includes(organizationType)) return { ok: false, error: 'Choose a valid organization type.' };
    if (organizationContactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(organizationContactEmail)) return { ok: false, error: 'Enter a valid organization contact email or leave it blank.' };
    if (organizationWebsite) {
      try { const url = new URL(organizationWebsite); if (!['http:', 'https:'].includes(url.protocol)) throw new Error('invalid'); }
      catch { return { ok: false, error: 'Enter a valid official website or leave it blank.' }; }
    }
    description ||= `Request to add ${organizationName}.`;
  } else if (!description) return { ok: false, error: 'Describe the problem.' };
  if (reporterEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reporterEmail)) return { ok: false, error: 'Enter a valid email address or leave it blank.' };
  if (!(pageUrl.startsWith('/') || /^https?:\/\//i.test(pageUrl))) return { ok: false, error: 'The reported page address is invalid.' };
  if (contentType && !contentId) return { ok: false, error: 'The content reference is invalid.' };
  const requestDetails = isOrganizationRequest ? {
    organization_name: organizationName,
    organization_type: organizationType,
    organization_contact_name: organizationContactName,
    organization_contact_email: organizationContactEmail,
    official_website: organizationWebsite,
  } : null;

  const requestHeaders = await headers();
  if (!consumeRateLimit('issue-report', requestFingerprint(requestHeaders), { limit: 5, windowMs: 10 * 60 * 1000 })) {
    return { ok: false, error: 'Please wait a few minutes before sending another report.' };
  }

  if (isDemoMode) return { ok: true, demo: true };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from('issue_reports').insert({
    issue_type: issueType,
    content_type: contentType,
    content_id: contentId,
    page_url: pageUrl,
    description,
    reporter_email: reporterEmail,
    request_details: requestDetails,
  });
  if (error) return { ok: false, error: 'The report could not be saved. Please try again.' };

  after(async () => {
    const result = await notifyIssueReport(issueType);
    if (!result.ok && !result.disabled) console.error('Issue-report notification could not be delivered.');
  });
  return { ok: true };
}

export async function updateIssueStatus(id, status) {
  if (!['in_review', 'resolved'].includes(status)) return { ok: false, error: 'Invalid issue status.' };
  const viewer = await getViewer();
  if (!viewer.user || !isAdmin(viewer)) return { ok: false, error: 'Administrator access required.' };
  if (isDemoMode) return { ok: true, demo: true };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from('issue_reports').update({
    status,
    resolved_at: status === 'resolved' ? new Date().toISOString() : null,
  }).eq('id', id);
  if (error) return { ok: false, error: 'The issue status could not be updated.' };
  revalidatePath('/admin/issues');
  return { ok: true };
}

export async function reviewOrganizationRequest(id, decision, note = '') {
  if (!['approved', 'rejected'].includes(decision)) return { ok: false, error: 'Choose Approve or Reject.' };
  const viewer = await getViewer();
  if (!viewer.user || !isAdmin(viewer)) return { ok: false, error: 'Administrator access required.' };
  if (decision === 'rejected' && String(note || '').trim().length < 3) return { ok: false, error: 'Add a short rejection reason.' };
  if (isDemoMode) return { ok: true, demo: true };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('review_organization_request', { p_issue_id: id, p_decision: decision, p_note: String(note || '').trim() || null });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/issues');
  revalidatePath('/panther-submit');
  return { ok: true, data };
}
