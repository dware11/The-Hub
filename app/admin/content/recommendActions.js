'use server';
import { getViewer,isAdmin } from '../../../lib/auth';
import { createServerSupabaseClient,isDemoMode } from '../../../lib/supabaseServerClient';
export async function resolveRecommendation(id,decision){const viewer=await getViewer();if(!isAdmin(viewer))return{ok:false,error:'Administrator access required.'};if(!['approve_recommendation','reject_recommendation','dismiss_recommendation'].includes(decision))return{ok:false,error:'Invalid decision.'};if(isDemoMode)return{ok:true,demo:true};const supabase=await createServerSupabaseClient();const{error}=await supabase.rpc('manage_announcement_editorial',{p_announcement_id:id,p_action:decision});return error?{ok:false,error:error.message}:{ok:true};}
