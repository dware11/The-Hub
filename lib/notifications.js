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

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

const WORKFLOW_COPY = Object.freeze({
  needs_correction: {
    subject: 'C.O.D.E. Hub: Action needed on your submission',
    heading: 'Changes were requested for your submission',
    instruction: 'A reviewer requested changes before this submission can be published. Open the submission, review the feedback, make your corrections, and choose Edit & Resubmit.',
    action: 'View Submission Status',
  },
  rejected: {
    subject: 'C.O.D.E. Hub: Submission review update',
    heading: 'Your submission was not approved',
    instruction: 'A reviewer determined that this submission cannot be published in its current form. Your submission history remains available in the Hub.',
    action: 'View Submission Status',
  },
  published: {
    subject: 'C.O.D.E. Hub: Your submission is published',
    heading: 'Your submission is now published',
    instruction: 'Your submission is now available to students in the Hub.',
    action: 'View Published Listing',
  },
});

export function buildWorkflowEmail({ notificationType, contentType, title, reason = '', destination }) {
  const copy = WORKFLOW_COPY[notificationType];
  if (!copy) return null;
  const normalizedType = String(contentType || 'submission');
  const contentTypeLabel = `${normalizedType.charAt(0).toUpperCase()}${normalizedType.slice(1)} Submission`;
  const reasonLabel = notificationType === 'rejected' ? 'Rejection reason' : 'Reviewer feedback';
  const reasonBlock = reason ? `<div style="margin:22px 0;padding:16px 18px;background:#f6f2fb;border-left:4px solid #d2aa28;border-radius:6px"><p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#5b4a78">${reasonLabel}</p><p style="margin:0;color:#28164f">${escapeHtml(reason)}</p></div>` : '';
  return {
    subject: copy.subject,
    text: `C.O.D.E. Engineering Hub\n\n${copy.heading}\n\n${contentTypeLabel}\n${title}\n\n${reason ? `${reasonLabel}: ${reason}\n\n` : ''}${copy.instruction}\n\n${copy.action}: ${destination}\n\nThis email was sent because you submitted content to the C.O.D.E. Engineering Hub.`,
    html: `<div style="margin:0;background:#f7f5f1;padding:24px 12px"><div style="box-sizing:border-box;max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5deee;border-radius:10px;padding:30px 26px;font-family:Arial,sans-serif;line-height:1.55;color:#1f1638"><p style="margin:0 0 24px;font-size:12px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:#6b5988">C.O.D.E. Engineering Hub</p><h1 style="margin:0 0 24px;font-size:26px;line-height:1.2;color:#28164f">${escapeHtml(copy.heading)}</h1><p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#78698e">${escapeHtml(contentTypeLabel)}</p><p style="margin:0 0 18px;font-size:19px;font-weight:700;line-height:1.35;color:#170a37">${escapeHtml(title)}</p>${reasonBlock}<p style="margin:0 0 22px;color:#413653">${escapeHtml(copy.instruction)}</p><p style="margin:0 0 26px"><a href="${escapeHtml(destination)}" style="display:inline-block;background:#28164f;color:#fff;padding:11px 17px;border-radius:7px;text-decoration:none;font-weight:700">${escapeHtml(copy.action)}</a></p><div style="border-top:1px solid #e5deee;padding-top:16px"><p style="margin:0;font-size:12px;color:#746b7e">This email was sent because you submitted content to the C.O.D.E. Engineering Hub.</p></div></div></div>`,
  };
}

export async function notifySubmissionStatus({ supabase, contentType, contentId, notificationType }) {
  const copy = WORKFLOW_COPY[notificationType];
  if (!copy) return { ok: false, error: 'unsupported_notification' };
  const { data: claim, error: claimError } = await supabase.rpc('claim_workflow_notification', {
    p_content_type: contentType,
    p_content_id: contentId,
    p_notification_type: notificationType,
  });
  if (claimError) return { ok: false, error: 'notification_claim_failed' };
  if (!claim?.send) return { ok: true, duplicate: true };

  const key = process.env.RESEND_API_KEY;
  const from = process.env.WORKFLOW_FROM_EMAIL || process.env.DIGEST_FROM_EMAIL;
  if (!key || !from) {
    await supabase.rpc('complete_workflow_notification', { p_notification_id: claim.notification_id, p_status: 'failed', p_error_code: 'configuration_missing' });
    return { ok: false, error: 'configuration_missing' };
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://hub.codepv.org').replace(/\/$/, '');
  const destination = notificationType === 'published' ? `${siteUrl}${claim.public_path}` : `${siteUrl}/panther-submit/submissions`;
  const email = buildWorkflowEmail({ notificationType, contentType, title: claim.title, reason: claim.reason, destination });
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [claim.recipient],
        subject: email.subject,
        text: email.text,
        html: email.html,
      }),
      signal: AbortSignal.timeout(10000),
    });
    const payload = await response.json().catch(() => ({}));
    await supabase.rpc('complete_workflow_notification', {
      p_notification_id: claim.notification_id,
      p_status: response.ok ? 'sent' : 'failed',
      p_provider_id: payload.id || null,
      p_error_code: response.ok ? null : `resend_${response.status}`,
    });
    return response.ok ? { ok: true, providerId: payload.id || null } : { ok: false, error: `resend_${response.status}` };
  } catch (error) {
    await supabase.rpc('complete_workflow_notification', { p_notification_id: claim.notification_id, p_status: 'failed', p_error_code: error?.name === 'TimeoutError' ? 'timeout' : 'provider_error' });
    return { ok: false, error: 'provider_error' };
  }
}

export function buildPeopleInvitationEmail({ firstName = '', destination = 'https://hub.codepv.org' } = {}) {
  const greeting = firstName ? `Hello ${firstName},` : 'Hello,';
  const subject = 'You’ve been added to the C.O.D.E. Engineering Hub';
  const intro = 'The C.O.D.E. Engineering Hub is a centralized space for Roy G. Perry College of Engineering students to find and share college events, opportunities, announcements, resources, and other student-focused information in one place.';
  const activation = 'You’ve been given access to the Hub.';
  return {
    subject,
    text: `C.O.D.E. ENGINEERING HUB\n\nYour Hub access is ready\n\n${greeting}\n\n${intro}\n\n${activation}\n\nTO ACTIVATE YOUR ACCESS\n1. Select “Sign In to the Hub” below.\n2. Enter the same PVAMU email address that received this message.\n3. Enter the six-digit verification code sent to your inbox.\n\nOnce you sign in, the Hub will show the tools and access available to you.\n\nSign In to the Hub: ${destination}\n\nUse the same PVAMU email address that received this invitation.`,
    html: `<div style="margin:0;background:#f7f5f1;padding:24px 12px"><div style="box-sizing:border-box;max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5deee;border-radius:10px;padding:30px 26px;font-family:Arial,sans-serif;line-height:1.55;color:#1f1638"><p style="margin:0 0 24px;font-size:12px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:#6b5988">C.O.D.E. ENGINEERING HUB</p><h1 style="margin:0 0 20px;font-size:26px;line-height:1.2;color:#28164f">Your Hub access is ready</h1><p style="margin:0 0 14px;color:#413653">${escapeHtml(greeting)}</p><p style="margin:0 0 14px;color:#413653">${escapeHtml(intro)}</p><p style="margin:0 0 20px;color:#413653">${escapeHtml(activation)}</p><p style="margin:22px 0 8px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#5b4a78">TO ACTIVATE YOUR ACCESS</p><ol style="margin:0 0 22px;padding-left:22px;color:#413653"><li>Select “Sign In to the Hub” below.</li><li>Enter the same PVAMU email address that received this message.</li><li>Enter the six-digit verification code sent to your inbox.</li></ol><p style="margin:0 0 22px;color:#413653">Once you sign in, the Hub will show the tools and access available to you.</p><p style="margin:0 0 26px"><a href="${escapeHtml(destination)}" style="display:inline-block;background:#28164f;color:#fff;padding:11px 17px;border-radius:7px;text-decoration:none;font-weight:700">Sign In to the Hub</a></p><div style="border-top:1px solid #e5deee;padding-top:16px"><p style="margin:0;font-size:12px;color:#746b7e">Use the same PVAMU email address that received this invitation.</p></div></div></div>`,
  };
}

export async function sendPeopleInvitation({ supabase, invitationId, resend = false }) {
  const { data: claim, error: claimError } = await supabase.rpc('claim_people_invitation_email', {
    p_invitation_id: invitationId,
    p_resend: resend,
  });
  if (claimError) return { ok: false, error: 'notification_claim_failed' };
  if (!claim?.send) return { ok: true, duplicate: true };

  const key = process.env.RESEND_API_KEY;
  const from = process.env.WORKFLOW_FROM_EMAIL || process.env.DIGEST_FROM_EMAIL;
  if (!key || !from) {
    await supabase.rpc('complete_people_invitation_email', { p_notification_id: claim.notification_id, p_status: 'failed', p_error_code: 'configuration_missing' });
    return { ok: false, error: 'configuration_missing' };
  }

  const destination = 'https://hub.codepv.org';
  const email = buildPeopleInvitationEmail({ firstName: claim.first_name, destination });
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [claim.recipient], subject: email.subject, text: email.text, html: email.html }),
      signal: AbortSignal.timeout(10000),
    });
    const payload = await response.json().catch(() => ({}));
    await supabase.rpc('complete_people_invitation_email', {
      p_notification_id: claim.notification_id,
      p_status: response.ok ? 'sent' : 'failed',
      p_provider_id: payload.id || null,
      p_error_code: response.ok ? null : `resend_${response.status}`,
    });
    return response.ok ? { ok: true } : { ok: false, error: `resend_${response.status}` };
  } catch (error) {
    await supabase.rpc('complete_people_invitation_email', {
      p_notification_id: claim.notification_id,
      p_status: 'failed',
      p_error_code: error?.name === 'TimeoutError' ? 'timeout' : 'provider_error',
    });
    return { ok: false, error: 'provider_error' };
  }
}
