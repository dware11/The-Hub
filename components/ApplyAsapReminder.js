'use client';

import { useState } from 'react';
import CalendarActions from './CalendarActions';

function displayTime(value) {
  const [hourValue, minute = '00'] = String(value || '').split(':');
  const hour = Number(hourValue);
  if (!Number.isFinite(hour)) return '';
  return `${hour % 12 || 12}:${minute} ${hour >= 12 ? 'PM' : 'AM'}`;
}

export default function ApplyAsapReminder({ opportunity }) {
  const [open,setOpen]=useState(false); const [date,setDate]=useState(''); const [time,setTime]=useState('');
  const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Chicago'});
  return <div className="apply-asap-reminder"><button type="button" className="gold-button" onClick={()=>setOpen(value=>!value)} aria-expanded={open}>Set Application Reminder</button>{open&&<div className="apply-asap-reminder-form"><p>This opportunity does not list a deadline. Choose a reminder soon so you do not forget to apply.</p><div><label>Reminder date<input type="date" min={today} value={date} onChange={event=>setDate(event.target.value)}/></label><label>Reminder time<input type="time" value={time} onChange={event=>setTime(event.target.value)}/></label></div>{date&&time&&<CalendarActions id={`apply-${opportunity.id}`} contentType="opportunity" title={`Apply: ${opportunity.title}`} date={date} time={displayTime(time)} location={opportunity.org} description={`Personal reminder to apply to ${opportunity.title} at ${opportunity.org}. This opportunity is Apply ASAP and may close at any time.${opportunity.link?` Application: ${opportunity.link}`:''}`} url={opportunity.hubUrl||opportunity.link} kind="reminder"/>}</div>}</div>;
}
