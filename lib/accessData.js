import { createServerSupabaseClient, isDemoMode } from './supabaseServerClient';

export async function getMyPendingAccessRequest(authUserId) {
  if (!authUserId || isDemoMode) return null;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('contributor_access_requests')
    .select('name, organization_department, representation_type, access_intent, request_target, created_at, updated_at')
    .eq('auth_user_id', authUserId)
    .eq('status', 'pending')
    .maybeSingle();
  if (error) throw new Error('Your contributor access status could not be loaded.');
  return data;
}
