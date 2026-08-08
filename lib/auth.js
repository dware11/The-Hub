import { createServerSupabaseClient, isDemoMode } from './supabaseServerClient';
import { demoCurrentUser } from './sampleData';

// Everything a page needs to know about "who is asking": the Supabase auth
// user (if signed in) plus their row in user_roles (if verified). Demo mode
// simulates a signed-in, verified admin so the whole flow -- submit form,
// admin review queue -- is walkable without real auth configured.
export async function getViewer() {
  if (isDemoMode) return { ...demoCurrentUser, demo: true };

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, role: null, demo: false };

  let { data: role, error: roleError } = await supabase
    .from('user_roles')
    .select('*')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  if (roleError) throw new Error('Panther Hub could not verify your access role.');

  if (!role) {
    const { error: claimError } = await supabase.rpc('claim_my_role');
    if (!claimError) {
      const claimed = await supabase
        .from('user_roles')
        .select('*')
        .eq('auth_user_id', user.id)
        .maybeSingle();
      role = claimed.data;
    }
  }


  return { user, role, demo: false };
}

export function isVerifiedContributor(viewer) {
  return Boolean(
    viewer.role &&
      viewer.role.status === 'active' &&
      ['platform_admin', 'code_officer', 'contributor'].includes(viewer.role.role)
  );
}

export function canReview(viewer) {
  return Boolean(
    viewer.role &&
      viewer.role.status === 'active' &&
      ['platform_admin', 'code_officer'].includes(viewer.role.role)
  );
}

export function isPlatformAdmin(viewer) {
  return Boolean(
    viewer.role &&
      viewer.role.status === 'active' &&
      viewer.role.role === 'platform_admin'
  );
}

export const isAdmin = canReview;
