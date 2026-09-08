'use server';

import { revalidatePath } from 'next/cache';
import { getViewer, isAdmin } from '../../../lib/auth';
import { createServerSupabaseClient, isDemoMode } from '../../../lib/supabaseServerClient';

export async function changeUserRole(id, role, status) {
  const viewer = await getViewer();
  if (!isAdmin(viewer)) return { ok: false, error: 'Administrator access required.' };
  if (!['contributor', 'reviewer', 'admin', 'super_admin'].includes(role) || !['active', 'needs_review'].includes(status)) return { ok: false, error: 'Invalid role or status.' };
  if (viewer.role?.role === 'admin' && !['contributor', 'reviewer'].includes(role)) return { ok: false, error: 'Administrators may manage contributors and reviewers only.' };
  if (isDemoMode) { revalidatePath('/admin/people'); return { ok: true, demo: true }; }
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('manage_user_role', { p_user_role_id: id, p_role: role, p_status: status });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/people');
  return { ok: true, data };
}
