'use server';

import { revalidatePath } from 'next/cache';
import { getViewer, canReview } from '../../../lib/auth';
import { setItemStatus, saveReviewEvidence, requestReviewCorrection } from '../../../lib/adminData';
import { createServerSupabaseClient, isDemoMode } from '../../../lib/supabaseServerClient';
import { notifySubmissionStatus } from '../../../lib/notifications';

async function requireReviewer() {
  const viewer = await getViewer();
  if (!canReview(viewer)) throw new Error('Not authorized');
}

async function sendWorkflowNotification(type, id, notificationType) {
  if (isDemoMode) return { ok: true, demo: true };
  const supabase = await createServerSupabaseClient();
  return notifySubmissionStatus({ supabase, contentType: type, contentId: id, notificationType });
}

export async function approveItem(type, id, evidence = {}) {
  try {
    await requireReviewer();
    const evidenceResult = await saveReviewEvidence(type, id, evidence, 'approved');
    if (!evidenceResult.ok) return evidenceResult;
    const result = await setItemStatus(type, id, 'published');
    if (result.ok) {
      const publicBase = type === 'event' ? '/events' : type === 'opportunity' ? '/opportunities' : '/announcements';
      ['/', '/admin/review', '/admin/content', '/admin/history', publicBase, `${publicBase}/${id}`].forEach(revalidatePath);
      if (type === 'event') revalidatePath('/events/all');
      result.notification = await sendWorkflowNotification(type, id, 'published');
    }
    return result;
  } catch (error) {
    return { ok: false, error: error.message || 'Approval failed.' };
  }
}

export async function rejectItem(type, id, reason = '', evidence = {}) {
  try {
    await requireReviewer();
    if (!reason.trim()) return { ok: false, error: 'Rejection reason required.' };
    const evidenceResult = await saveReviewEvidence(type, id, { ...evidence, reviewer_notes: reason }, 'rejected');
    if (!evidenceResult.ok) return evidenceResult;
    const result = await setItemStatus(type, id, 'rejected', reason);
    if (result.ok) result.notification = await sendWorkflowNotification(type, id, 'rejected');
    revalidatePath('/admin/review');
    revalidatePath('/panther-submit');
    return result;
  } catch (error) {
    return { ok: false, error: error.message || 'Rejection failed.' };
  }
}

export async function requestCorrection(type, id, reason, evidence = {}) {
  try {
    await requireReviewer();
    if (!reason || !reason.trim()) return { ok: false, error: 'Correction reason required.' };
    const evidenceResult = await saveReviewEvidence(type, id, { ...evidence, reviewer_notes: reason }, 'needs_correction');
    if (!evidenceResult.ok) return evidenceResult;
    const result = await requestReviewCorrection(type, id, reason);
    if (result.ok) result.notification = await sendWorkflowNotification(type, id, 'needs_correction');
    revalidatePath('/admin/review');
    revalidatePath('/panther-submit');
    return result;
  } catch (error) {
    return { ok: false, error: error.message || 'Correction request failed.' };
  }
}

export async function reviewStaleApplyAsap(id, action) {
  try {
    await requireReviewer();
    if (!['continue_review', 'mark_closed'].includes(action)) return { ok: false, error: 'Choose a valid availability action.' };
    if (isDemoMode) return { ok: true, demo: true };
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc('review_stale_apply_asap', { p_opportunity_id: id, p_action: action });
    if (error) return { ok: false, error: error.message };
    revalidatePath('/admin/review');
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error.message || 'Availability check failed.' };
  }
}
