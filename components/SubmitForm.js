'use client';

import { useState } from 'react';
import { submitContent } from '../lib/data';
import { isDemoMode } from '../lib/supabaseClient';
import { parseFlyer } from '../lib/flyerParser';
import { uploadFlyer } from '../lib/storage';
import { MAJORS } from '../lib/sampleData';

const OPPORTUNITY_TYPES = ['Internship', 'Co-op', 'Research', 'Scholarship', 'Competition'];
const EVENT_TYPES = ['Org meeting', 'Workshop', 'Career fair', 'Competition', 'College event'];

function emptyFields(viewer) {
  return {
    title: '',
    org: viewer.role?.org || '',
    subtype: 'Internship',
    paid: false,
    description: '',
    date: '',
    time: '',
    deadline: '',
    location: '',
    link: '',
    contactName: viewer.role?.full_name || '',
    contactEmail: viewer.user?.email || '',
    presenterName: '',
    presenterAffiliation: '',
    majors: ['All majors'],
    source: viewer.role?.org || 'C.O.D.E.',
    body: '',
  };
}

export default function SubmitForm({ viewer }) {
  const [type, setType] = useState('opportunity');
  const [fields, setFields] = useState(() => emptyFields(viewer));
  const [detected, setDetected] = useState({});
  const [accountSourced] = useState({ contactName: true, contactEmail: true });

  const [pasteText, setPasteText] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extracted, setExtracted] = useState(false);

  const [contactConfirmed, setContactConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  function update(key, value) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  function toggleMajor(m) {
    setFields((f) => {
      const has = f.majors.includes(m);
      let majors = has ? f.majors.filter((x) => x !== m) : [...f.majors.filter((x) => x !== 'All majors'), m];
      if (majors.length === 0) majors = ['All majors'];
      return { ...f, majors };
    });
  }

  function onFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handleExtract() {
    if (!pasteText.trim() && !imageFile) return;
    setExtracting(true);
    setProgress(0);
    setError('');
    try {
      const result = await parseFlyer({
        text: pasteText.trim() || undefined,
        imageFile: pasteText.trim() ? undefined : imageFile,
        onProgress: setProgress,
      });
      setFields((f) => ({
        ...f,
        title: result.fields.title || f.title,
        date: result.fields.date || f.date,
        time: result.fields.time || f.time,
        deadline: result.fields.deadline || f.deadline,
        location: result.fields.location || f.location,
        link: result.fields.link || f.link,
        contactName: result.detected.contactName ? result.fields.contactName : f.contactName,
        contactEmail: result.detected.contactEmail ? result.fields.contactEmail : f.contactEmail,
        presenterName: result.fields.presenterName || f.presenterName,
        presenterAffiliation: result.fields.presenterAffiliation || f.presenterAffiliation,
      }));
      setDetected(result.detected);
      setExtracted(true);
    } catch (err) {
      setError("Couldn't read that image — try pasting the text instead, or fill the form in below.");
      setExtracted(true);
    } finally {
      setExtracting(false);
    }
  }

  const isPvamu = fields.contactEmail.toLowerCase().endsWith('@pvamu.edu');
  const contactEntered = fields.contactEmail.trim().length > 0;
  const readyToSubmit = !contactEntered || contactConfirmed;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!readyToSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      const flyerUrl = imageFile ? await uploadFlyer(imageFile) : null;

      let payload;
      if (type === 'opportunity') {
        payload = {
          title: fields.title,
          org: fields.org,
          type: fields.subtype,
          paid: fields.paid,
          majors: fields.majors,
          description: fields.description,
          deadline: fields.deadline,
          location: fields.location,
          link: fields.link,
          contact_name: fields.contactName,
          contact_email: fields.contactEmail,
          flyer_url: flyerUrl,
        };
      } else if (type === 'event') {
        payload = {
          title: fields.title,
          org: fields.org,
          type: fields.subtype,
          majors: fields.majors,
          description: fields.description,
          date: fields.date,
          time: fields.time,
          location: fields.location,
          registration_link: fields.link || null,
          presenter_name: fields.presenterName || null,
          presenter_affiliation: fields.presenterAffiliation || null,
          contact_name: fields.contactName,
          contact_email: fields.contactEmail,
          flyer_url: flyerUrl,
        };
      } else {
        payload = {
          source: fields.source,
          title: fields.title,
          body: fields.body,
          pinned: false,
        };
      }

      const result = await submitContent(type, payload, viewer.role?.id);
      if (result.ok) setSubmitted(true);
      else setError(result.error || 'Something went wrong submitting this.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto mt-16">
        <div className="flex items-center gap-4 bg-purple-900 text-white rounded-xl p-6">
          <div className="w-10 h-10 rounded-full bg-gold-400 text-purple-900 flex items-center justify-center flex-shrink-0">
            ✓
          </div>
          <div>
            <div className="font-display font-semibold">Sent for review</div>
            <div className="text-sm text-purple-100">
              C.O.D.E. will review "{fields.title}" shortly.
              {isDemoMode && ' (Demo mode — nothing was actually saved. Connect Supabase to make this real.)'}
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            setFields(emptyFields(viewer));
            setDetected({});
            setPasteText('');
            setImageFile(null);
            setImagePreview(null);
            setExtracted(false);
            setContactConfirmed(false);
            setSubmitted(false);
          }}
          className="mt-6 text-sm text-purple-700 hover:underline"
        >
          Submit another
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-16">
      <div className="mt-9 mb-6">
        <h1 className="font-display text-2xl text-purple-900">Submit to the Hub</h1>
        <div className="text-sm text-slate mt-1">
          Paste what you already have — we'll pull out the details and ask only for what's missing.
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {['opportunity', 'event', 'announcement'].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`font-display font-semibold text-sm px-4 py-2 rounded-lg border-2 capitalize ${
              type === t ? 'bg-purple-900 text-white border-purple-900' : 'bg-white text-slate border-line'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {type !== 'announcement' && (
        <div className="bg-white border border-line rounded-xl p-5 mb-6">
          <div className="text-xs font-mono uppercase tracking-wide text-slate mb-2">Paste text</div>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={5}
            placeholder="Paste a flyer's text, forward an email body, or just type the details — dates, location, who's presenting, whatever you've got."
            className="input mb-4"
          />

          <div className="text-xs font-mono uppercase tracking-wide text-slate mb-2">Or upload a flyer / screenshot</div>
          <label className="flex items-center gap-3 border-2 border-dashed border-line rounded-lg p-4 cursor-pointer hover:border-gold-400 hover:bg-gold-100/40">
            {imagePreview ? (
              <img src={imagePreview} alt="Flyer preview" className="w-12 h-14 object-cover rounded border border-line" />
            ) : (
              <div className="w-9 h-9 rounded-md bg-purple-100 flex items-center justify-center text-purple-700 text-lg">↑</div>
            )}
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{imageFile ? imageFile.name : 'Upload flyer / screenshot'}</div>
              <div className="text-xs text-slate">Flyers, screenshots, and photos all work</div>
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={onFileChange} />
          </label>

          <button
            type="button"
            onClick={handleExtract}
            disabled={extracting || (!pasteText.trim() && !imageFile)}
            className="mt-4 w-full bg-purple-900 text-white text-sm font-medium py-3 rounded-lg hover:bg-purple-700 disabled:opacity-40"
          >
            {extracting
              ? imageFile && !pasteText.trim()
                ? `Reading the flyer… ${Math.round(progress * 100)}%`
                : 'Pulling out the details…'
              : 'Pull out the details →'}
          </button>
          {error && <div className="text-xs text-coral mt-2">{error}</div>}
        </div>
      )}

      {(extracted || type === 'announcement') && (
        <div className="flex items-center gap-2 bg-purple-100 text-purple-700 text-sm rounded-lg px-4 py-3 mb-6">
          <span>✓</span>
          {type === 'announcement'
            ? 'Fill in the announcement below.'
            : "We found what we could automatically. Just fill in anything marked Needed, then send it for review."}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FieldRow label="Title" status={detected.title ? 'detected' : extracted ? 'needed' : null}>
          <input required value={fields.title} onChange={(e) => update('title', e.target.value)} className="input" />
        </FieldRow>

        {type === 'announcement' ? (
          <>
            <FieldRow label="Source">
              <input required value={fields.source} onChange={(e) => update('source', e.target.value)} className="input" placeholder="e.g. College of Engineering" />
            </FieldRow>
            <FieldRow label="Body">
              <textarea required value={fields.body} onChange={(e) => update('body', e.target.value)} rows={4} className="input" />
            </FieldRow>
          </>
        ) : (
          <>
            <FieldRow label="Organization / posted by" required>
              <input required value={fields.org} onChange={(e) => update('org', e.target.value)} className="input" />
            </FieldRow>

            <FieldRow label="Description" required>
              <textarea required value={fields.description} onChange={(e) => update('description', e.target.value)} rows={4} className="input" />
            </FieldRow>

            {type === 'opportunity' ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <FieldRow label="Type" required>
                    <select value={fields.subtype} onChange={(e) => update('subtype', e.target.value)} className="input">
                      {OPPORTUNITY_TYPES.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </FieldRow>
                  <FieldRow label="Deadline" required status={detected.deadline ? 'detected' : extracted ? 'needed' : null}>
                    <input required type="date" value={fields.deadline} onChange={(e) => update('deadline', e.target.value)} className="input" />
                  </FieldRow>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={fields.paid} onChange={(e) => update('paid', e.target.checked)} />
                  This is paid
                </label>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <FieldRow label="Type" required>
                    <select value={fields.subtype} onChange={(e) => update('subtype', e.target.value)} className="input">
                      {EVENT_TYPES.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </FieldRow>
                  <FieldRow label="Date" required status={detected.date ? 'detected' : extracted ? 'needed' : null}>
                    <input required type="date" value={fields.date} onChange={(e) => update('date', e.target.value)} className="input" />
                  </FieldRow>
                </div>
                <FieldRow label="Time" status={detected.time ? 'detected' : null}>
                  <input value={fields.time} onChange={(e) => update('time', e.target.value)} placeholder="e.g. 4:00–5:15 PM" className="input" />
                </FieldRow>
                <div className="grid grid-cols-2 gap-4">
                  <FieldRow label="Featured presenter" status={detected.presenterName ? 'detected' : null}>
                    <input value={fields.presenterName} onChange={(e) => update('presenterName', e.target.value)} className="input" placeholder="Optional" />
                  </FieldRow>
                  <FieldRow label="Presenter affiliation" status={detected.presenterAffiliation ? 'detected' : (fields.presenterName && extracted) ? 'needed' : null}>
                    <input value={fields.presenterAffiliation} onChange={(e) => update('presenterAffiliation', e.target.value)} className="input" placeholder="e.g. PVAMU Alum · Texas Instruments" />
                  </FieldRow>
                </div>
              </>
            )}

            <FieldRow label="Location" status={detected.location ? 'detected' : extracted ? 'needed' : null}>
              <input value={fields.location} onChange={(e) => update('location', e.target.value)} className="input" />
            </FieldRow>

            <FieldRow
              label={type === 'event' ? 'Registration link' : 'Application link'}
              required={type !== 'event'}
              status={detected.link ? 'detected' : extracted ? 'needed' : null}
            >
              <input
                required={type !== 'event'}
                value={fields.link}
                onChange={(e) => update('link', e.target.value)}
                className="input"
                placeholder={type === 'event' ? 'Paste a signup link, or leave blank if it\'s walk-in' : 'https://'}
              />
            </FieldRow>

            <div className="grid grid-cols-2 gap-4">
              <FieldRow label="Point of contact — name" required status={accountSourced.contactName && !detected.contactName ? 'account' : detected.contactName ? 'detected' : null}>
                <input required value={fields.contactName} onChange={(e) => update('contactName', e.target.value)} className="input" />
              </FieldRow>
              <FieldRow label="Point of contact — email" required status={accountSourced.contactEmail && !detected.contactEmail ? 'account' : detected.contactEmail ? 'detected' : null}>
                <input required type="email" value={fields.contactEmail} onChange={(e) => { update('contactEmail', e.target.value); setContactConfirmed(false); }} className="input" />
              </FieldRow>
            </div>

            {contactEntered && (
              isPvamu ? (
                <label className="flex items-start gap-2 text-xs text-slate bg-purple-100/50 rounded-lg px-3 py-2.5">
                  <input type="checkbox" checked={contactConfirmed} onChange={(e) => setContactConfirmed(e.target.checked)} className="mt-0.5" />
                  <span>Confirm this is correct — <span className="font-mono">{fields.contactEmail}</span> will be publicly visible on this post.</span>
                </label>
              ) : (
                <label className="flex items-start gap-2 text-xs text-coral bg-[#FBEDE5] rounded-lg px-3 py-3">
                  <input type="checkbox" checked={contactConfirmed} onChange={(e) => setContactConfirmed(e.target.checked)} className="mt-0.5" />
                  <span>
                    This isn't a pvamu.edu address — it'll be publicly visible on this post. Are you sure you want to
                    use it? An org email, if one exists, is usually a better choice. Check to confirm you want to use{' '}
                    <span className="font-mono">{fields.contactEmail}</span> anyway.
                  </span>
                </label>
              )
            )}

            <FieldRow label="Who's this for?">
              <div className="flex flex-wrap gap-2">
                {MAJORS.map((m) => (
                  <button
                    type="button"
                    key={m}
                    onClick={() => toggleMajor(m)}
                    className={`font-mono text-xs px-3 py-1.5 rounded-md border ${
                      fields.majors.includes(m) ? 'bg-purple-900 text-white border-purple-900' : 'border-line'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </FieldRow>
          </>
        )}

        <div className="flex justify-between items-center mt-4 pt-5 border-t border-line">
          <div className="text-xs text-slate max-w-xs">
            This goes to C.O.D.E.'s review queue before it's visible to students.
          </div>
          <button
            type="submit"
            disabled={submitting || !readyToSubmit}
            className="bg-gold-400 text-purple-900 font-semibold text-sm px-6 py-3 rounded-lg hover:bg-gold-600 disabled:opacity-50"
          >
            {submitting ? 'Sending…' : 'Send for review →'}
          </button>
        </div>
        {error && <div className="text-xs text-coral">{error}</div>}
      </form>

      <style jsx global>{`
        .input {
          width: 100%;
          border: 1px solid #E7E2EF;
          border-radius: 8px;
          padding: 10px 13px;
          font-size: 13.5px;
          font-family: inherit;
        }
        .input:focus {
          outline: 2px solid #B8912B;
          outline-offset: 1px;
        }
      `}</style>
    </div>
  );
}

function FieldRow({ label, required, status, children }) {
  return (
    <label className="block">
      <span className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium">
          {label} {required && <span className="text-coral">*</span>}
        </span>
        {status === 'detected' && (
          <span className="font-mono text-[10px] text-purple-700 bg-purple-100 px-2 py-0.5 rounded flex items-center gap-1">
            ✓ Detected
          </span>
        )}
        {status === 'needed' && (
          <span className="font-mono text-[10px] text-coral bg-[#FBEDE5] px-2 py-0.5 rounded">Needed</span>
        )}
        {status === 'account' && (
          <span className="font-mono text-[10px] text-slate bg-paper border border-line px-2 py-0.5 rounded">
            From your account
          </span>
        )}
      </span>
      {children}
    </label>
  );
}
