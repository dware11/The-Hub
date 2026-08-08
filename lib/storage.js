import { createClient, isDemoMode } from './supabaseClient';

// Uploads the original flyer/screenshot to the public `flyers` bucket
// (see supabase/schema.sql) and returns its public URL, which gets saved
// on the opportunity/event row as `flyer_url` -- that's what powers the
// "View original flyer" link on published posts.
export async function uploadFlyer(file) {
  if (isDemoMode || !file) return null;
  const supabase = createClient();
  const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
  const { error } = await supabase.storage.from('flyers').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) return null;
  const { data } = supabase.storage.from('flyers').getPublicUrl(path);
  return data.publicUrl;
}
