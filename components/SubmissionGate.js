import { getViewer, canSubmit, isSuperAdmin } from '../lib/auth';
import SignInButton from './SignInButton';
import AccessRequestForm from './AccessRequestForm';
import PantherSubmitForm from './PantherSubmitForm';
import { getMyPendingAccessRequest } from '../lib/accessData';
import { getMySubmissionStatuses } from '../lib/submissionStatus';
import SubmissionStatusSummary from './SubmissionStatusSummary';

export default async function SubmissionGate({ target = 'general' }) {
  const viewer = await getViewer();
  const destination = target === 'event' ? '/submit/event' : target === 'opportunity' ? '/submit/opportunity' : '/panther-submit';
  const contact = target === 'event' ? (process.env.NEXT_PUBLIC_EVENT_CONTACT_EMAIL || process.env.NEXT_PUBLIC_CODE_CONTACT_EMAIL) : target === 'opportunity' ? (process.env.NEXT_PUBLIC_OPPORTUNITY_CONTACT_EMAIL || process.env.NEXT_PUBLIC_CODE_CONTACT_EMAIL) : process.env.NEXT_PUBLIC_CODE_CONTACT_EMAIL;
  const label = target === 'event' ? 'events' : target === 'opportunity' ? 'opportunities' : 'content';
  if (!viewer.user) return <div className="auth-card"><h1>Sign in to submit</h1><p>Use a passwordless email link. You will return to this submission page.</p><SignInButton next={destination} /></div>;
  if (!canSubmit(viewer)) {
    const pendingRequest = await getMyPendingAccessRequest(viewer.user.id);
    return <div className="access-page-shell"><div className="eyebrow">Contributor access</div><h1>You’re signed in, but your account does not have submission access yet.</h1><p>Contributor access allows you to submit information to the Hub for human review. Approval does not grant administrative access.</p><p>Need {label} shared promptly? {contact ? <a href={`mailto:${contact}`}>Email the {label} contact</a> : 'Contact the C.O.D.E. team through the official channel.'}</p><AccessRequestForm viewer={viewer} target={target} existingRequest={pendingRequest} /></div>;
  }
  const submissions = await getMySubmissionStatuses();
  return <><SubmissionStatusSummary submissions={submissions} /><PantherSubmitForm viewer={viewer} feedbackEnabled={isSuperAdmin(viewer)} initialContentType={target === 'general' ? '' : target} /></>;
}
