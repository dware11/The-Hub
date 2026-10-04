'use server';
import { revalidatePath } from 'next/cache';
import { getViewer, isAdmin } from '../../../lib/auth';
import { reviewAccessRequest } from '../../../lib/committeeData';
export async function decideAccessRequest(id,decision,reason){const viewer=await getViewer();if(!isAdmin(viewer))return{ok:false,error:'Administrator access required'};const result=await reviewAccessRequest(id,decision,reason);revalidatePath('/admin/committee');return result;}
