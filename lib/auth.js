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

  const { data: role } = await supabase
    .from('user_roles')
    .select('*')
    .eq('email', user.email)
    .maybeSingle();

  return { user, role, demo: false };
}

export function isVerifiedContributor(viewer) {
  return Boolean(viewer.role && viewer.role.status === 'active');
}

export function isAdmin(viewer) {
  return Boolean(viewer.role && viewer.role.role === 'admin' && viewer.role.status === 'active');
}
