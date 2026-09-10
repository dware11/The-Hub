// Optional generic operational notices. No requester names, emails, IDs, or
// source/submission details leave the app. Missing configuration is disabled.
export function notifyOperationalEvent(subject) {
  const key=process.env.RESEND_API_KEY; const from=process.env.DIGEST_FROM_EMAIL; const to=process.env.REQUEST_NOTIFICATION_TO_EMAIL || process.env.DIGEST_TO_EMAIL;
  if(!key||!from||!to)return Promise.resolve({ok:false,disabled:true});
  return fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:to.split(',').map(v=>v.trim()).filter(Boolean),subject:`C.O.D.E. Hub: ${subject}`,text:'A new item may require Website Committee attention. Sign in to the protected dashboard for details.'}),signal:AbortSignal.timeout(3000)}).then(response=>({ok:response.ok})).catch(()=>({ok:false}));
}

export function notifyIssueReport(issueType) {
  return notifyOperationalEvent(`new issue report — ${String(issueType || 'Other').slice(0, 80)}`);
}
