'use server';
import { revalidatePath } from 'next/cache';
import { getViewer, isAdmin, isSuperAdmin } from '../../../lib/auth';
import { createServerSupabaseClient, isDemoMode } from '../../../lib/supabaseServerClient';
export async function manageContent(type,id,action,changes={}){const viewer=await getViewer();if(!isAdmin(viewer))return{ok:false,error:'Administrator access required'};if(isDemoMode){revalidatePath('/admin/content');return{ok:true,demo:true};}const supabase=await createServerSupabaseClient();const rpc=type==='announcement'&&action==='edit'?'manage_announcement_editorial':'manage_published_content';const args=rpc==='manage_announcement_editorial'?{p_announcement_id:id,p_action:'edit',p_priority:changes.priority||null,p_is_featured:changes.is_featured??null,p_featured_until:changes.featured_until||null,p_expires_at:changes.expires_at||null,p_category:changes.category||null,p_source_url:changes.source_url||null}:{p_content_type:type,p_content_id:id,p_action:action,p_changes:changes};const{data,error}=await supabase.rpc(rpc,args);if(error)return{ok:false,error:error.message};['/admin/content','/','/opportunities','/events','/events/all','/announcements'].forEach(revalidatePath);return{ok:true,data};}

export async function setHomeSpotlight(type,id,isFeatured,rank=1){
  const viewer=await getViewer();
  if(!isAdmin(viewer))return{ok:false,error:'Administrator access required'};
  if(isDemoMode){revalidatePath('/admin/content');revalidatePath('/');return{ok:true,demo:true};}
  const tables={opportunity:'opportunities',event:'events',announcement:'announcements'};
  const table=tables[type];
  if(!table)return{ok:false,error:'Choose a valid content type.'};
  const supabase=await createServerSupabaseClient();
  if(isFeatured){
    const{data:target,error:targetError}=await supabase.from(table).select('status,is_featured').eq('id',id).maybeSingle();
    if(targetError||!target)return{ok:false,error:'The selected content could not be found.'};
    if(target.status!=='published')return{ok:false,error:'Only published content can be added to Home Spotlight.'};
    if(!target.is_featured){
      const counts=await Promise.all(Object.values(tables).map(name=>supabase.from(name).select('id',{count:'exact',head:true}).eq('status','published').eq('is_featured',true)));
      if(counts.some(result=>result.error))return{ok:false,error:'The active Spotlight count could not be verified. Try again.'};
      if(counts.reduce((sum,result)=>sum+(result.count||0),0)>=3)return{ok:false,error:'Home Spotlight already has 3 active items. Remove an existing Spotlight item before adding another.'};
    }
  }
  const{data,error}=await supabase.rpc('manage_home_spotlight',{p_content_type:type,p_content_id:id,p_is_featured:Boolean(isFeatured),p_rank:isFeatured?Math.max(1,Math.min(3,Number(rank)||1)):null});
  if(error)return{ok:false,error:error.message};
  revalidatePath('/admin/content');revalidatePath('/');
  return{ok:true,data};
}

export async function setHomeAnnouncement(id, highlighted) {
  const viewer = await getViewer();
  if (!isAdmin(viewer)) return { ok: false, error: 'Administrator access required' };
  if (isDemoMode) {
    revalidatePath('/admin/content');
    revalidatePath('/');
    return { ok: true, demo: true };
  }
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('manage_home_announcement', {
    p_announcement_id: id,
    p_highlighted: Boolean(highlighted),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/content');
  revalidatePath('/');
  return { ok: true, data };
}

export async function setHomeEvent(id,visible,rank=99){const viewer=await getViewer();if(!isAdmin(viewer))return{ok:false,error:'Administrator access required'};if(isDemoMode){revalidatePath('/admin/content');revalidatePath('/');return{ok:true,demo:true};}const supabase=await createServerSupabaseClient();const{data,error}=await supabase.rpc('manage_home_event',{p_event_id:id,p_visible:Boolean(visible),p_rank:visible?Math.max(1,Math.min(99,Number(rank)||99)):null});if(error)return{ok:false,error:error.message};revalidatePath('/admin/content');revalidatePath('/');return{ok:true,data};}

export async function hardDeleteContent(type,id,reason){const viewer=await getViewer();if(!isSuperAdmin(viewer))return{ok:false,error:'Super Admin access required'};const cleaned=String(reason||'').trim();if(cleaned.length<10)return{ok:false,error:'Enter a deletion reason of at least 10 characters.'};if(isDemoMode)return{ok:true,demo:true};const supabase=await createServerSupabaseClient();const{data,error}=await supabase.rpc('hard_delete_content',{p_content_type:type,p_content_id:id,p_reason:cleaned});if(error)return{ok:false,error:error.message};['/admin/content','/admin/history','/','/opportunities','/events','/events/all','/announcements'].forEach(revalidatePath);return{ok:true,data};}

export async function confirmOpportunityAvailability(id){
  const viewer=await getViewer();
  if(!isAdmin(viewer))return{ok:false,error:'Administrator access required'};
  if(isDemoMode)return{ok:true,demo:true,last_verified_at:new Date().toISOString(),next_review_at:new Date(Date.now()+30*86400000).toISOString().slice(0,10)};
  const supabase=await createServerSupabaseClient();
  const{data:opportunity,error:opportunityError}=await supabase.from('opportunities').select('id,status,deadline_type').eq('id',id).maybeSingle();
  if(opportunityError||!opportunity)return{ok:false,error:'The opportunity could not be found.'};
  if(opportunity.status!=='published'||opportunity.deadline_type!=='rolling')return{ok:false,error:'Only published Apply ASAP opportunities can be availability-checked.'};
  const now=new Date();const nextReview=new Date(now.getTime()+30*86400000).toISOString().slice(0,10);
  const{data,error}=await supabase.from('opportunity_availability_reviews').upsert({opportunity_id:id,last_verified_at:now.toISOString(),next_review_at:nextReview,verified_by:viewer.role.id,updated_at:now.toISOString()},{onConflict:'opportunity_id'}).select('last_verified_at,next_review_at').single();
  if(error)return{ok:false,error:'The availability review could not be saved.'};
  revalidatePath('/admin/content');
  return{ok:true,data};
}
