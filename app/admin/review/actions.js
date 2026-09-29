'use server';

import { revalidatePath } from 'next/cache';
import { getViewer, canReview } from '../../../lib/auth';
import { setItemStatus, saveReviewEvidence, requestReviewCorrection } from '../../../lib/adminData';

async function requireReviewer() {
  const viewer = await getViewer();
  if (!canReview(viewer)) throw new Error('Not authorized');
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
    revalidatePath('/admin/review');
    revalidatePath('/panther-submit');
    return result;
  } catch (error) {
    return { ok: false, error: error.message || 'Correction request failed.' };
  }
}
