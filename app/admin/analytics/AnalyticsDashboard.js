'use client';
import { useState } from 'react';

const periods=[['week','Last 7 Days'],['month','Last 30 Days'],['all','Since Launch']];
const count=(entry,type,actions)=>entry?.available===false?null:(Array.isArray(actions)?actions:[actions]).reduce((sum,action)=>sum+Number(entry?.counts?.[type]?.[action]||0),0);

export default function AnalyticsDashboard({engagement,submissions,published,demo=false}) {
  const[window,setWindow]=useState('month'); const e=engagement?.[window]||{available:false,counts:{}}; const s=submissions?.[window]||{}; const p=published?.[window]||{};
  const clicks=(count(e,'opportunity',['application_click','source_click'])||0)+(count(e,'event','source_click')||0); const eventEngagement=(count(e,'event',['detail_view','registration_click','calendar_outlook','calendar_google'])||0);
  const publishedTotal=[p.opportunities,p.events,p.announcements].every(Number.isFinite)?p.opportunities+p.events+p.announcements:null;
  const cards=[['Submissions received',s.total,'Work that entered the review process','Team productivity'],['Items published',publishedTotal,'Opportunities, events, and announcements made live','Team productivity'],['Opportunity actions',e.available?clicks:null,'Students who opened an application or official source','Student result'],['Event interest',e.available?eventEngagement:null,'Event views, registrations, and calendar adds','Student result']];
  const bars=[['Opportunity actions',clicks],['Event interest',eventEngagement],['Announcements read',count(e,'announcement','list_view')]]; const max=Math.max(1,...bars.map(([,value])=>Number(value)||0));
  return <section className="impact-analytics">{demo&&<div className="analytics-mode-note"><strong>Demo / Test Mode</strong><span>These values demonstrate the reporting experience and are not production launch impact.</span></div>}<div className="analytics-periods" role="group" aria-label="Analytics reporting period">{periods.map(([key,label])=><button type="button" key={key} className={window===key?'active':''} aria-pressed={window===key} onClick={()=>setWindow(key)}>{label}</button>)}</div>
    <section className="analytics-summary analytics-summary-compact" aria-label="Impact summary"><span>Impact summary</span><div><strong>{window==='month'?'Last 30 days':window==='week'?'Last 7 days':'Since launch'}</strong><p>{Number.isFinite(p.opportunities)?p.opportunities:'—'} opportunities and {Number.isFinite(p.events)?p.events:'—'} events published · {e.available?`${clicks} outbound clicks · ${eventEngagement} event interactions`:'Engagement data unavailable'}</p></div></section>
    <section className="analytics-chart analytics-simple-chart" aria-labelledby="activity-chart-title"><header><div><div className="eyebrow">Student response</div><h2 id="activity-chart-title">What students acted on</h2><p>These are recorded actions, not estimates.</p></div></header><div className="analytics-bars">{bars.map(([label,value])=><div className="analytics-bar-row" key={label}><span>{label}</span><div><i style={{width:`${((Number(value)||0)/max)*100}%`}}/></div><strong>{e.available&&Number.isFinite(value)?value:'—'}</strong></div>)}</div></section>
    <div className="analytics-impact-kpis analytics-simple-kpis">{cards.map(([label,value,note,group])=><article key={label}><span>{group}</span><strong>{Number.isFinite(value)?value:'—'}</strong><h2>{label}</h2><small>{Number.isFinite(value)?note:'Requires live analytics data'}</small></article>)}</div>
  </section>;
}
