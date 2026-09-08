'use client';
import { useState } from 'react';
import { recommendFeature } from './recommendActions';
export default function RecommendationPanel({ announcements }) { const [message,setMessage]=useState(''); async function act(id){setMessage('Sending recommendation…'); const r=await recommendFeature(id); setMessage(r.ok?'Recommendation sent to administrators.':r.error||'Could not send recommendation.');} return <section className="review-recommendations"><h2>Published announcement recommendations</h2><p>Reviewers can recommend featuring; only administrators can apply or reject it.</p>{announcements.map(a=><div key={a.id}><span>{a.title}</span><button className="chip" onClick={()=>act(a.id)}>Recommend featuring</button></div>)}<p role="status" aria-live="polite">{message}</p></section>; }
