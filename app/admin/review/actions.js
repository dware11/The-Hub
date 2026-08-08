'use server';

import { revalidatePath } from 'next/cache';
import { getViewer, isAdmin } from '../../../lib/auth';
import { setItemStatus } from '../../../lib/adminData';

async function requireAdmin() {
  const viewer = await getViewer();
  if (!isAdmin(viewer)) throw new Error('Not authorized');
}

export async function approveItem(type, id) {
  await requireAdmin();
  const result = await setItemStatus(type, id, 'published');
  revalidatePath('/admin/review');
  return result;
}

export async function rejectItem(type, id) {
  await requireAdmin();
  const result = await setItemStatus(type, id, 'rejected');
  revalidatePath('/admin/review');
  return result;
}
