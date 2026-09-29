'use server';

import { revalidatePath } from 'next/cache';
import { getViewer, canSubmit } from '../../lib/auth';
import { createServerSupabaseClient, isDemoMode } from '../../lib/supabaseServerClient';
import { SUBMISSION_DEADLINE_TYPE_VALUES, OPPORTUNITY_COMPENSATION_TYPES } from '../../lib/opportunityOptions';

const TABLES = { event: 'events', opportunity: 'opportunities', announcement: 'announcements' };
const FIELDS = {
  event: ['title','org','date','end_date','time','location','description','registration_link','contact_name','contact_email'],
  opportunity: ['title','org','deadline_type','deadline','posted_date','compensation_type','location','description','eligibility','link','contact_name','contact_email'],
  announcement: ['title','source','body','source_url','category'],
};

function clean(value, max = 5000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : value;
}

async function requireContributor() {
  const viewer = await getViewer();
  if (!viewer.user || !canSubmit(viewer)) throw new Error('Contributor access required.');
  return viewer;
}

export async function resubmitCorrectionAction(input) {
  try {
    await requireContributor();
    const type = input?.contentType;
    const id = input?.contentId;
    if (!TABLES[type] || !id) return { ok: false, error: 'Invalid submission.' };
    const values = Object.fromEntries(FIELDS[type].filter((field) => Object.hasOwn(input.values || {}, field)).map((field) => [field, clean(input.values[field])]));
    if (type === 'opportunity') {
      if (!SUBMISSION_DEADLINE_TYPE_VALUES.has(values.deadline_type)) return { ok: false, error: 'Choose a valid deadline option.' };
      if (values.deadline_type !== 'specific_date') values.deadline = null;
      if (!OPPORTUNITY_COMPENSATION_TYPES.includes(values.compensation_type)) return { ok: false, error: 'Choose Paid or Unpaid compensation.' };
    }
    const required = type === 'event' ? ['title','org','date','description'] : type === 'opportunity' ? ['title','org','description','link'] : ['title','source','body'];
    const missing = required.find((field) => !String(values[field] || '').trim());
    if (missing) return { ok: false, error: `Add the required ${missing.replaceAll('_',' ')} before resubmitting.` };
    if (type === 'opportunity' && (!values.deadline_type || values.deadline_type === 'specific_date') && !String(values.deadline || '').trim()) {
      return { ok: false, error: 'Add the required deadline before resubmitting.' };
    }
    if (isDemoMode) return { ok: true, demo: true };
    const supabase = await createServerSupabaseClient();
    const { error: updateError } = await supabase.from(TABLES[type]).update(values).eq('id', id).eq('status', 'needs_correction');
    if (updateError) return { ok: false, error: 'Your corrections could not be saved. Please try again.' };
    const { data, error } = await supabase.rpc('resubmit_corrected_content', { p_content_type: type, p_content_id: id });
    if (error) return { ok: false, error: error.message };
    revalidatePath('/panther-submit');
    return data || { ok: true };
  } catch (error) {
    return { ok: false, error: error.message || 'The correction could not be submitted.' };
  }
}

export async function dismissRejectedSubmissionAction(contentType, contentId) {
  try {
    await requireContributor();
    if (!TABLES[contentType] || !contentId) return { ok: false, error: 'Invalid submission.' };
    if (isDemoMode) return { ok: true, demo: true };
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc('dismiss_own_submission', { p_content_type: contentType, p_content_id: contentId });
    if (error) return { ok: false, error: error.message };
    revalidatePath('/panther-submit');
    return data || { ok: true };
  } catch (error) {
    return { ok: false, error: error.message || 'The submission could not be dismissed.' };
  }
}
