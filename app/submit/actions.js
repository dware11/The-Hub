'use server';

import { revalidatePath } from 'next/cache';
import { getViewer, isVerifiedContributor } from '../../lib/auth';
import { createServerSupabaseClient, isDemoMode } from '../../lib/supabaseServerClient';
import { validateSubmission } from '../../lib/validation';

const TABLES = Object.freeze({
  opportunity: 'opportunities',
  event: 'events',
  announcement: 'announcements',
});

export async function submitContentAction(type, input) {
  const table = TABLES[type];
  if (!table) return { ok: false, error: 'Unknown content type.' };

  const viewer = await getViewer();
  if (!viewer.user || !isVerifiedContributor(viewer)) {
    return { ok: false, error: 'You are not authorized to submit content.' };
  }

  let payload;
  try {
    payload = validateSubmission(type, input);
  } catch (error) {
    return { ok: false, error: error.message };
  }

  if (isDemoMode) return { ok: true, demo: true };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from(table)
    .insert([
      {
        ...payload,
        submitted_by: viewer.role.id,
        status: 'pending',
      },
    ])
    .select('id, status')
    .single();

  if (error) return { ok: false, error: 'The submission could not be saved.' };

  revalidatePath('/admin/review');
  return { ok: true, data };
}
