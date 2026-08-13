'use client';

import { useMemo, useState } from 'react';
import { createClient, isDemoMode } from '../lib/supabaseClient';
import { parseMultipleSources } from '../lib/multiSourceParser';
import { beginIntakeAction, finalizeIntakeAction } from '../app/panther-submit/actions';
import { MAJORS } from '../lib/sampleData';

const CONTENT_TYPES = [
  { id: 'event', title: 'Event', description: 'Something students attend at a scheduled time.' },
  { id: 'opportunity', title: 'Opportunity', description: 'Something students apply for, join, earn, or pursue.' },
  { id: 'announcement', title: 'Announcement', description: 'An important notice or reminder.' },
];

const RELATIONSHIPS = [
  ['original_contact', 'I am the original contact'],
  ['pvamu_department_referral', 'PVAMU department, faculty, or staff referral'],
  ['student_organization_referral', 'Student organization referral'],
  ['sponsor_referral', 'Sponsor or corporate partner referral'],
  ['alumni_referral', 'Alumni referral'],
  ['external_discovery', 'Found on LinkedIn, Handshake, or another external source'],
  ['other', 'Other'],
];

const SOURCE_TYPES = [
  ['flyer', 'Flyer image'],
  ['program_pdf', 'Program PDF'],
  ['email_screenshot', 'Email screenshot'],
  ['screenshot', 'Post or webpage screenshot'],
  ['other', 'Other supporting source'],
];

const OPPORTUNITY_TYPES = ['Internship', 'Co-op', 'Research', 'Scholarship', 'Competition', 'Other'];
const EVENT_TYPES = ['Org meeting', 'Workshop', 'Career fair', 'Competition', 'College event', 'Other'];
const MAX_PIXELS = 40_000_000;

function emptyFields(viewer, type) {
  return {
    title: '',
    org: viewer.role?.org || '',
    subtype: type === 'event' ? 'Workshop' : 'Internship',
    paid: false,
    description: '',
    date: '',
    time: '',
    deadline: '',
    location: '',
    link: '',
    contactName: viewer.role?.full_name || '',
    contactEmail: viewer.user?.email || '',
    majors: ['All majors'],
    source: viewer.role?.org || 'C.O.D.E.',
    body: '',
    presenterName: '',
    presenterAffiliation: '',
  };
}

function mb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function validateClientFile(file) {
  const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
  if (!allowed.includes(file.type)) {
    throw new Error(`${file.name} is not a supported PNG, JPEG, WebP, or PDF.`);
  }
  const limit = file.type === 'application/pdf' ? 15 * 1024 * 1024 : 10 * 1024 * 1024;
  if (file.size > limit) {
    throw new Error(
      `${file.name} is ${mb(file.size)}. The limit is ${mb(limit)}. Export a smaller copy, upload a screenshot of the relevant page, paste the text, or enter details manually.`
    );
  }
  if (file.type.startsWith('image/')) {
    const bitmap = await createImageBitmap(file);
    const pixels = bitmap.width * bitmap.height;
    bitmap.close();
    if (pixels > MAX_PIXELS) {
      throw new Error(
        `${file.name} contains too many pixels to process safely. Export a smaller copy or take a screenshot of the relevant section.`
      );
    }
  }
}

export default function PantherSubmitForm({ viewer }) {
  const [step, setStep] = useState(1);
  const [contentType, setContentType] = useState('');
  const [relationship, setRelationship] = useState('');
  const [referral, setReferral] = useState({ name: '', title: '', organization: '', email: '', mayDisplay: false });
  const [artifacts, setArtifacts] = useState([]);
  const [nextSourceType, setNextSourceType] = useState('flyer');
  const [pastedText, setPastedText] = useState('');
  const [parseResult, setParseResult] = useState(null);
  const [fields, setFields] = useState(() => emptyFields(viewer, 'opportunity'));
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [contactConfirmed, setContactConfirmed] = useState(false);

  const combinedBytes = useMemo(() => artifacts.reduce((sum, artifact) => sum + artifact.file.size, 0), [artifacts]);

  function chooseType(type) {
    setContentType(type);
    setFields(emptyFields(viewer, type));
    setParseResult(null);
    setStep(2);
  }

  function updateField(name, value) {
    setFields((current) => ({ ...current, [name]: value }));
  }

  function updateReferral(name, value) {
    setReferral((current) => ({ ...current, [name]: value }));
  }

  function toggleMajor(major) {
    setFields((current) => {
      const selected = current.majors.includes(major);
      let majors = selected
        ? current.majors.filter((value) => value !== major)
        : [...current.majors.filter((value) => value !== 'All majors'), major];
      if (!majors.length) majors = ['All majors'];
      return { ...current, majors };
    });
  }

  async function addFiles(event) {
    const selected = [...(event.target.files || [])];
    setError('');
    if (artifacts.length + selected.length > 3) {
      setError('You may add up to three source files.');
      event.target.value = '';
      return;
    }
    try {
      for (const file of selected) await validateClientFile(file);
      const incoming = selected.map((file) => ({
        id: crypto.randomUUID(),
        sourceType: file.type === 'application/pdf' ? 'program_pdf' : nextSourceType,
        name: file.name,
        file,
      }));
      const total = combinedBytes + incoming.reduce((sum, item) => sum + item.file.size, 0);
      if (total > 25 * 1024 * 1024) throw new Error('The combined source files exceed 25 MB. Remove a file or upload smaller copies.');
      setArtifacts((current) => [...current, ...incoming]);
    } catch (reason) {
      setError(reason.message);
    } finally {
      event.target.value = '';
    }
  }

  function removeArtifact(id) {
    setArtifacts((current) => current.filter((artifact) => artifact.id !== id));
  }

  async function extract() {
    if (!artifacts.length && !pastedText.trim()) {
      setError('Add a source or paste text, or continue with manual entry.');
      return;
    }
    setError('');
    setProgress({ source: 'Preparing sources', progress: 0 });
    try {
      const result = await parseMultipleSources({
        contentType,
        artifacts,
        pastedText,
        onProgress: setProgress,
      });
      setParseResult(result);
      setFields((current) => ({
        ...current,
        title: result.fields.title || current.title,
        org: result.fields.organization || current.org,
        description: result.fields.description || current.description,
        date: result.fields.date || current.date,
        time: result.fields.time || current.time,
        deadline: result.fields.deadline || current.deadline,
        location: result.fields.location || current.location,
        link: result.fields.link || current.link,
        paid: result.tags.paid || current.paid,
        subtype: result.tags.categories[0] && (contentType === 'event' ? EVENT_TYPES : OPPORTUNITY_TYPES).includes(result.tags.categories[0])
          ? result.tags.categories[0]
          : current.subtype,
        majors: result.tags.majors.length ? result.tags.majors : current.majors,
        contactName: relationship === 'original_contact' && result.fields.contactName ? result.fields.contactName : current.contactName,
        contactEmail: relationship === 'original_contact' && result.fields.contactEmail ? result.fields.contactEmail : current.contactEmail,
        presenterName: result.fields.presenterName || current.presenterName,
        presenterAffiliation: result.fields.presenterAffiliation || current.presenterAffiliation,
      }));
      setStep(4);
    } catch (reason) {
      setError(reason.message || 'The sources could not be processed. You can continue manually.');
      setStep(4);
    } finally {
      setProgress(null);
    }
  }

  function buildPayload(flyerUrl = null) {
    if (contentType === 'announcement') {
      return { source: fields.source, title: fields.title, body: fields.body, pinned: false };
    }
    const common = {
      title: fields.title,
      org: fields.org,
      type: fields.subtype,
      majors: fields.majors,
      description: fields.description,
      location: fields.location,
      contact_name: fields.contactName,
      contact_email: fields.contactEmail,
      flyer_url: flyerUrl,
    };
    return contentType === 'event'
      ? {
          ...common,
          date: fields.date,
          time: fields.time,
          registration_link: fields.link || null,
          presenter_name: fields.presenterName || null,
          presenter_affiliation: fields.presenterAffiliation || null,
        }
      : { ...common, paid: fields.paid, deadline: fields.deadline, link: fields.link };
  }

  async function submit(event) {
    event.preventDefault();
    if (contentType !== 'announcement' && fields.contactEmail && !contactConfirmed) {
      setError('Confirm the public contact information before submitting.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const intake = await beginIntakeAction({
        contentType,
        relationshipToSource: relationship,
        referral,
        artifacts: artifacts.map((artifact) => ({
          clientId: artifact.id,
          sourceType: artifact.sourceType,
          name: artifact.file.name,
          mimeType: artifact.file.type,
          byteSize: artifact.file.size,
        })),
      });
      if (!intake.ok) throw new Error(intake.error);

      if (!intake.demo && intake.uploads.length) {
        const supabase = createClient();
        for (const upload of intake.uploads) {
          const artifact = artifacts.find((item) => item.id === upload.clientId);
          const { error: uploadError } = await supabase.storage
            .from('intake-sources')
            .uploadToSignedUrl(upload.path, upload.token, artifact.file, {
              contentType: artifact.file.type,
            });
          if (uploadError) throw new Error(`${artifact.name} could not be uploaded securely. Please try again.`);
        }
      }

      const finalized = await finalizeIntakeAction({
        intakeSessionId: intake.intakeSessionId,
        contentType,
        payload: buildPayload(null),
        suggestions: parseResult?.provenance || {},
        confirmedValues: fields,
      });
      if (!finalized.ok) throw new Error(finalized.error);
      setSubmitted(true);
    } catch (reason) {
      setError(reason.message || 'The submission could not be completed.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto mt-16 bg-white border border-line rounded-2xl p-8">
        <div className="font-display text-xl text-purple-900">Submitted for human review</div>
        <p className="text-sm text-slate mt-2">
          Panther Hub received “{fields.title}.” Nothing is published until an authorized reviewer approves it.
          {isDemoMode && ' This was a demo submission and was not saved.'}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <header className="mt-9 mb-8">
        <div className="font-mono text-xs uppercase tracking-wider text-gold-600">Panther Hub contributor intake</div>
        <h1 className="font-display text-3xl text-purple-900 mt-1">Share something useful with students</h1>
        <p className="text-sm text-slate mt-2">Add what you already have. Panther Hub will suggest details and ask only for what is missing.</p>
      </header>

      <div className="grid grid-cols-4 gap-2 mb-8">
        {['Type', 'Relationship', 'Sources', 'Confirm'].map((label, index) => (
          <div key={label} className={`rounded-lg px-3 py-2 text-xs font-mono ${step >= index + 1 ? 'bg-purple-900 text-white' : 'bg-white border border-line text-slate'}`}>
            {index + 1}. {label}
          </div>
        ))}
      </div>

      {step === 1 && (
        <Panel title="What are you sharing with students?">
          <div className="grid md:grid-cols-3 gap-4">
            {CONTENT_TYPES.map((item) => (
              <button key={item.id} type="button" onClick={() => chooseType(item.id)} className="text-left border-2 border-line rounded-xl p-5 hover:border-gold-400 hover:-translate-y-0.5 transition">
                <div className="font-display font-semibold text-purple-900">{item.title}</div>
                <div className="text-sm text-slate mt-2">{item.description}</div>
              </button>
            ))}
          </div>
        </Panel>
      )}

      {step === 2 && (
        <Panel title="How did this reach Panther Hub?">
          <div className="grid md:grid-cols-2 gap-3">
            {RELATIONSHIPS.map(([value, label]) => (
              <label key={value} className={`border rounded-lg p-3 text-sm cursor-pointer ${relationship === value ? 'border-purple-900 bg-purple-100' : 'border-line bg-white'}`}>
                <input type="radio" name="relationship" className="mr-2" checked={relationship === value} onChange={() => setRelationship(value)} />
                {label}
              </label>
            ))}
          </div>
          {relationship && relationship !== 'original_contact' && (
            <div className="grid md:grid-cols-2 gap-4 mt-5 border-t border-line pt-5">
              <Input label="Who shared or referred it?" value={referral.name} onChange={(value) => updateReferral('name', value)} />
              <Input label="Title or relationship" value={referral.title} onChange={(value) => updateReferral('title', value)} />
              <Input label="Department or organization" value={referral.organization} onChange={(value) => updateReferral('organization', value)} />
              <Input label="Referral email" type="email" value={referral.email} onChange={(value) => updateReferral('email', value)} />
              <label className="md:col-span-2 text-xs text-slate flex gap-2 items-start">
                <input type="checkbox" checked={referral.mayDisplay} onChange={(event) => updateReferral('mayDisplay', event.target.checked)} />
                This referral contact may be displayed publicly if a reviewer confirms it is appropriate.
              </label>
            </div>
          )}
          <Navigation back={() => setStep(1)} next={() => relationship && setStep(3)} nextDisabled={!relationship} />
        </Panel>
      )}

      {step === 3 && (
        <Panel title="Add your sources">
          <p className="text-sm text-slate mb-5">
            {contentType === 'event'
              ? 'An event flyer is best for date, time, location, host, and registration. An email screenshot adds audience and referral context.'
              : contentType === 'opportunity'
                ? 'A flyer or program PDF is best for eligibility, compensation, deadline, and application details. An email screenshot adds audience and referral context.'
                : 'Paste the announcement or add the original notice and supporting screenshot.'}
          </p>
          <div className="grid md:grid-cols-[1fr_auto] gap-3">
            <select value={nextSourceType} onChange={(event) => setNextSourceType(event.target.value)} className="input">
              {SOURCE_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <label className="bg-purple-900 text-white rounded-lg px-5 py-3 text-sm cursor-pointer text-center">
              Add source file
              <input type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf" className="hidden" onChange={addFiles} />
            </label>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            {artifacts.map((artifact) => (
              <div key={artifact.id} className="flex items-center justify-between border border-line rounded-lg px-4 py-3 bg-paper">
                <div>
                  <div className="text-sm font-medium">{artifact.name}</div>
                  <div className="text-xs text-slate">{SOURCE_TYPES.find(([value]) => value === artifact.sourceType)?.[1]} · {mb(artifact.file.size)}</div>
                </div>
                <button type="button" className="text-xs text-coral" onClick={() => removeArtifact(artifact.id)}>Remove</button>
              </div>
            ))}
          </div>

          <label className="block mt-5">
            <span className="text-sm font-medium block mb-1.5">Paste email or posting text</span>
            <textarea value={pastedText} onChange={(event) => setPastedText(event.target.value)} rows={6} className="input" placeholder="Paste the relevant message or posting text. Unrelated email history is not needed." />
          </label>

          {progress && <div className="mt-4 text-xs text-purple-700">Processing {progress.source} — {Math.round((progress.progress || 0) * 100)}%</div>}
          <Navigation back={() => setStep(2)} next={extract} nextLabel={artifacts.length || pastedText.trim() ? 'Extract suggestions' : 'Continue manually'} />
        </Panel>
      )}

      {step === 4 && (
        <form onSubmit={submit}>
          <Panel title="Confirm the student-facing details">
            {parseResult?.warnings?.map((warning) => <Notice key={`${warning.code}-${warning.artifactId || ''}`}>{warning.message}</Notice>)}
            {parseResult?.conflicts?.map((conflict) => <Notice key={conflict.field}>{conflict.message}</Notice>)}

            {parseResult?.source?.processed?.length > 0 && (
              <div className="border border-line rounded-xl p-4 mb-5 bg-paper">
                <div className="text-xs font-mono uppercase text-slate mb-2">Source extraction results</div>
                {parseResult.source.processed.map((source) => (
                  <div key={source.artifactId} className="text-xs text-slate mt-1">
                    <strong className="text-purple-900">{source.sourceName}:</strong>{' '}
                    {source.status === 'processed'
                      ? `${source.rawText ? 'text detected' : 'no text detected'}${Number.isFinite(source.confidence) ? ` · OCR confidence ${Math.round(source.confidence)}%` : ''}`
                      : source.status === 'needs_review' ? 'manual review needed' : 'automatic extraction failed'}
                  </div>
                ))}
              </div>
            )}
            {parseResult?.tags && (
              <div className="border border-line rounded-xl p-4 mb-5 bg-paper">
                <div className="text-xs font-mono uppercase text-slate mb-2">Suggested classifications — reviewer confirmation required</div>
                <div className="flex flex-wrap gap-2">
                  {[...parseResult.tags.categories, ...parseResult.tags.sectors, ...parseResult.tags.workModes, ...parseResult.tags.qualifications].map((tag) => (
                    <span key={tag} className="text-xs bg-purple-100 text-purple-700 rounded-full px-3 py-1">{tag}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <Input label="Title" required value={fields.title} onChange={(value) => updateField('title', value)} />
              <Input label={contentType === 'announcement' ? 'Source' : 'Organization, employer, or host'} required value={contentType === 'announcement' ? fields.source : fields.org} onChange={(value) => updateField(contentType === 'announcement' ? 'source' : 'org', value)} />
            </div>

            {contentType === 'announcement' ? (
              <label className="block mt-4"><span className="text-sm font-medium block mb-1.5">Announcement</span><textarea required className="input" rows={6} value={fields.body} onChange={(event) => updateField('body', event.target.value)} /></label>
            ) : (
              <>
                <label className="block mt-4"><span className="text-sm font-medium block mb-1.5">Description</span><textarea required className="input" rows={6} value={fields.description} onChange={(event) => updateField('description', event.target.value)} /></label>
                <div className="grid md:grid-cols-2 gap-4 mt-4">
                  <label><span className="text-sm font-medium block mb-1.5">Category</span><select className="input" value={fields.subtype} onChange={(event) => updateField('subtype', event.target.value)}>{(contentType === 'event' ? EVENT_TYPES : OPPORTUNITY_TYPES).map((value) => <option key={value}>{value}</option>)}</select></label>
                  <Input label={contentType === 'event' ? 'Event date' : 'Application deadline'} type="date" required value={contentType === 'event' ? fields.date : fields.deadline} onChange={(value) => updateField(contentType === 'event' ? 'date' : 'deadline', value)} />
                  {contentType === 'event' && <Input label="Time" value={fields.time} onChange={(value) => updateField('time', value)} placeholder="4:00–5:15 PM" />}
                  <Input label="Location" value={fields.location} onChange={(value) => updateField('location', value)} />
                  <Input label={contentType === 'event' ? 'Registration link' : 'Application link'} type="url" required={contentType === 'opportunity'} value={fields.link} onChange={(value) => updateField('link', value)} />
                  <Input label="Public contact name" required value={fields.contactName} onChange={(value) => updateField('contactName', value)} />
                  <Input label="Public contact email" type="email" required value={fields.contactEmail} onChange={(value) => { updateField('contactEmail', value); setContactConfirmed(false); }} />
                </div>
                {contentType === 'opportunity' && <label className="flex gap-2 items-center text-sm mt-4"><input type="checkbox" checked={fields.paid} onChange={(event) => updateField('paid', event.target.checked)} />Paid or funded</label>}
                <div className="mt-5"><div className="text-sm font-medium mb-2">Eligible majors</div><div className="flex flex-wrap gap-2">{MAJORS.map((major) => <button type="button" key={major} onClick={() => toggleMajor(major)} className={`text-xs rounded-full px-3 py-1.5 border ${fields.majors.includes(major) ? 'bg-purple-900 text-white border-purple-900' : 'border-line'}`}>{major}</button>)}</div></div>
                <label className="flex items-start gap-2 text-xs text-slate bg-purple-100 rounded-lg p-3 mt-5"><input type="checkbox" checked={contactConfirmed} onChange={(event) => setContactConfirmed(event.target.checked)} /><span>I confirm this is the appropriate contact to display publicly. The referral source remains separate unless a reviewer approves it for display.</span></label>
              </>
            )}

            <div className="flex justify-between items-center mt-7 pt-5 border-t border-line">
              <button type="button" className="text-sm text-purple-700" onClick={() => setStep(3)}>Back to sources</button>
              <button type="submit" disabled={submitting} className="bg-gold-400 text-purple-900 font-semibold rounded-lg px-6 py-3 disabled:opacity-50">{submitting ? 'Submitting…' : 'Submit for human review'}</button>
            </div>
          </Panel>
        </form>
      )}

      {error && <div role="alert" className="mt-4 bg-[#FBEDE5] text-coral rounded-lg p-4 text-sm">{error}</div>}

      <style jsx global>{`.input{width:100%;border:1px solid #E7E2EF;border-radius:8px;padding:10px 13px;font-size:13.5px;font-family:inherit}.input:focus{outline:2px solid #B8912B;outline-offset:1px}`}</style>
    </div>
  );
}

function Panel({ title, children }) {
  return <section className="bg-white border border-line rounded-2xl p-6 md:p-8"><h2 className="font-display text-xl text-purple-900 mb-5">{title}</h2>{children}</section>;
}

function Input({ label, value, onChange, type = 'text', required, placeholder }) {
  return <label className="block"><span className="text-sm font-medium block mb-1.5">{label}{required && <span className="text-coral"> *</span>}</span><input className="input" type={type} required={required} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Navigation({ back, next, nextDisabled, nextLabel = 'Continue' }) {
  return <div className="flex justify-between mt-7 pt-5 border-t border-line"><button type="button" className="text-sm text-purple-700" onClick={back}>Back</button><button type="button" disabled={nextDisabled} className="bg-purple-900 text-white rounded-lg px-5 py-2.5 text-sm disabled:opacity-40" onClick={next}>{nextLabel}</button></div>;
}

function Notice({ children }) {
  return <div className="bg-gold-100 text-ink border border-gold-400 rounded-lg p-3 text-sm mb-3">{children}</div>;
}
