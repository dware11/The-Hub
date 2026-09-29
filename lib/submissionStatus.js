import 'server-only';
import { createServerSupabaseClient, isDemoMode } from './supabaseServerClient';

export async function getMySubmissionStatuses() {
  if (isDemoMode) return [];
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('get_my_submission_status');
  if (error) {
    if (process.env.NODE_ENV !== 'production') console.warn('Submission status unavailable:', error.message);
    return [];
  }
  return Array.isArray(data) ? data : [];
}
