'use server';

import { revalidatePath } from 'next/cache';
import { getViewer, canReview } from '../../../lib/auth';
import { setItemStatus } from '../../../lib/adminData';

async function requireReviewer() {
  const viewer = await getViewer();
  if (!canReview(viewer)) throw new Error('Not authorized');
}

export async function approveItem(type, id) {
  await requireReviewer();
  const result = await setItemStatus(type, id, 'published');
  revalidatePath('/admin/review');
  return result;
}

export async function rejectItem(type, id) {
  await requireReviewer();
  const result = await setItemStatus(type, id, 'rejected');
  revalidatePath('/admin/review');
  return result;
}
