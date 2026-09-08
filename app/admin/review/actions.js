'use server';

import { revalidatePath } from 'next/cache';
import { getViewer, canReview } from '../../../lib/auth';
import { setItemStatus, saveReviewEvidence, requestReviewCorrection } from '../../../lib/adminData';

async function requireReviewer() {
  const viewer = await getViewer();
  if (!canReview(viewer)) throw new Error('Not authorized');
}

export async function approveItem(type, id, evidence = {}) {
  await requireReviewer();
  const evidenceResult = await saveReviewEvidence(type, id, evidence, 'approved');
  if (!evidenceResult.ok) return evidenceResult;
  const result = await setItemStatus(type, id, 'published');
  revalidatePath('/admin/review');
  return result;
}

export async function rejectItem(type, id, reason = '', evidence = {}) {
  await requireReviewer();
  const evidenceResult = await saveReviewEvidence(type, id, { ...evidence, reviewer_notes: reason }, 'rejected');
  if (!evidenceResult.ok) return evidenceResult;
  const result = await setItemStatus(type, id, 'rejected', reason);
  revalidatePath('/admin/review');
  return result;
}

export async function requestCorrection(type, id, reason) {
  await requireReviewer();
  if (!reason || !reason.trim()) return { ok: false, error: 'Correction reason required' };
  const result = await requestReviewCorrection(type, id, reason);
  revalidatePath('/admin/review');
  return result;
}
