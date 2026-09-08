'use server';
import { getViewer, canReview } from '../../../lib/auth';
import { createServerSupabaseClient, isDemoMode } from '../../../lib/supabaseServerClient';
export async function recommendFeature(id){const viewer=await getViewer();if(!canReview(viewer))return{ok:false,error:'Reviewer access required'};if(isDemoMode)return{ok:true,demo:true};const supabase=await createServerSupabaseClient();const{error}=await supabase.rpc('recommend_announcement_feature',{p_announcement_id:id});return error?{ok:false,error:error.message}:{ok:true};}
