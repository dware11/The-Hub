'use server';
import { revalidatePath } from 'next/cache';
import { getViewer, canReview } from '../../../lib/auth';
import { reviewAccessRequest } from '../../../lib/committeeData';
export async function decideAccessRequest(id,decision,reason){const viewer=await getViewer();if(!canReview(viewer))return{ok:false,error:'Reviewer access required'};const result=await reviewAccessRequest(id,decision,reason);revalidatePath('/admin/committee');return result;}
