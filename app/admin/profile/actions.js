'use server';

import { revalidatePath } from 'next/cache';
import { getViewer } from '../../../lib/auth';
import { createServerSupabaseClient, isDemoMode } from '../../../lib/supabaseServerClient';

export async function updateDisplayName(fullName) {
  const viewer = await getViewer();
  if (!viewer.user || !viewer.role) return { ok: false, error: 'Active workspace access required.' };
  const cleaned = String(fullName || '').trim();
  if (cleaned.length < 2 || cleaned.length > 120) return { ok: false, error: 'Enter your full name (2–120 characters).' };
  if (isDemoMode) return { ok: true, demo: true, fullName: cleaned };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('update_my_display_name', { p_full_name: cleaned });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin', 'layout');
  return { ok: true, data, fullName: cleaned };
}
