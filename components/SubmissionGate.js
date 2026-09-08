import { getViewer, canSubmit } from '../lib/auth';
import SignInButton from './SignInButton';
import AccessRequestForm from './AccessRequestForm';
import PantherSubmitForm from './PantherSubmitForm';

export default async function SubmissionGate({ target = 'general' }) {
  const viewer = await getViewer();
  const destination = target === 'event' ? '/submit/event' : target === 'opportunity' ? '/submit/opportunity' : '/panther-submit';
  const contact = target === 'event' ? (process.env.NEXT_PUBLIC_EVENT_CONTACT_EMAIL || process.env.NEXT_PUBLIC_CODE_CONTACT_EMAIL) : target === 'opportunity' ? (process.env.NEXT_PUBLIC_OPPORTUNITY_CONTACT_EMAIL || process.env.NEXT_PUBLIC_CODE_CONTACT_EMAIL) : process.env.NEXT_PUBLIC_CODE_CONTACT_EMAIL;
  const label = target === 'event' ? 'events' : target === 'opportunity' ? 'opportunities' : 'content';
  if (!viewer.user) return <div className="auth-card"><h1>Sign in to submit</h1><p>Use a passwordless email link. You will return to this submission page.</p><SignInButton next={destination} /></div>;
  if (!canSubmit(viewer)) return <div className="max-w-2xl mx-auto mt-12"><h1 className="font-display text-2xl text-purple-900">Request contributor access</h1><p className="text-sm text-slate mt-2">Your account is signed in as a viewer. Complete the official request for Website Committee review. Approval lets you submit; it does not publish content.</p><p className="text-sm text-slate mt-2 mb-6">Need a {label} uploaded promptly? {contact ? <a className="underline" href={`mailto:${contact}`}>Email the {label} contact</a> : 'Contact the C.O.D.E. team through the official channel.'} If you expect repeated submissions, request recurring contributor registration.</p><AccessRequestForm viewer={viewer} target={target} /></div>;
  return <PantherSubmitForm viewer={viewer} feedbackEnabled initialContentType={target === 'general' ? '' : target} />;
}
