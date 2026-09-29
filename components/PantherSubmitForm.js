'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, isDemoMode } from '../lib/supabaseClient';
import { extractSubmission, toSubmissionParserResult } from '../lib/submissionExtraction';
import { abandonIntakeAction, beginIntakeAction, finalizeIntakeAction, saveParserFeedbackAction } from '../app/panther-submit/actions';
import { MAJORS } from '../lib/sampleData';
import { ANNOUNCEMENT_CATEGORIES } from '../lib/announcementCategories';
import WorkspaceIdentityForm from './WorkspaceIdentityForm';
import ReportIssueForm from './ReportIssueForm';
import { SUBMISSION_DEADLINE_TYPES, FULL_TIME_DEFAULT_CLASSIFICATIONS, OPPORTUNITY_CLASSIFICATIONS, OPPORTUNITY_TYPES, deadlineLabel, normalizeOpportunityClassifications } from '../lib/opportunityOptions';
import { REGISTERED_EVENT_ORGANIZATIONS } from '../lib/eventCategories';

const CONTENT_TYPES = [
  { id: 'event', title: 'Event', description: 'Something students attend at a scheduled time.' },
  { id: 'opportunity', title: 'Opportunity', description: 'Something students apply for, join, earn, or pursue.' },
  { id: 'announcement', title: 'Announcement', description: 'An important notice or reminder.' },
];

const RELATIONSHIPS = [
  ['student_organization', 'Student organization'],
  ['faculty_staff', 'Faculty / staff'],
  ['department_college', 'Department / college representative'],
  ['alumni', 'Alumni'],
  ['corporate_industry', 'Corporate / industry representative'],
  ['ambassador', 'Ambassador'],
  ['organizer_host', 'Event organizer / host'],
  ['general_contributor', 'General contributor / No formal affiliation'],
  ['other', 'Other'],
];

const RELATIONSHIP_STORAGE = {
  student_organization: 'student_organization_referral',
  faculty_staff: 'pvamu_department_referral',
  department_college: 'pvamu_department_referral',
  alumni: 'alumni_referral',
  corporate_industry: 'sponsor_referral',
  ambassador: 'other',
  organizer_host: 'original_contact',
  general_contributor: 'external_discovery',
  other: 'other',
};

const APPROVED_ORGANIZATIONS = [
  'Roy G. Perry College of Engineering',
  ...REGISTERED_EVENT_ORGANIZATIONS.map((organization) => organization.label),
];

const SOURCE_TYPES = [
  ['program_pdf', 'Program PDF'],
  ['screenshot', 'Screenshot / Image'],
];

const SUBMISSION_ACKNOWLEDGMENT = 'By submitting this event, I confirm that the information provided is accurate to the best of my knowledge and that I am authorized to share it or obtained it from an official or public source. C.O.D.E. Engineering Hub may rely on the information submitted and may verify, correct, or decline to publish it.';

const EVENT_TYPES = ['Org meeting', 'Workshop', 'Career fair', 'Competition', 'College event', 'Other'];
const CLASSIFICATIONS = OPPORTUNITY_CLASSIFICATIONS;
const WORK_MODES = ['Remote', 'Hybrid', 'In person'];
const COMPENSATION_TYPES = ['Paid', 'Unpaid'];
const MAX_PIXELS = 40_000_000;
const FIELD_LABELS = {
  title: 'Title',
  organization: 'Hosting organization',
  description: 'Description',
  eligibility: 'Eligibility',
  date: 'Event date',
  time: 'Time',
  start_time: 'Start time',
  end_time: 'End time',
  deadline: 'Application deadline',
  location: 'Location',
  link: 'Registration or application link',
  source_url: 'Registration or application link',
  contactName: 'Official contact name',
  contactEmail: 'Official contact email',
  contact_name: 'Official contact name',
  contact_email: 'Official contact email',
  presenterName: 'Presenter name',
  presenterAffiliation: 'Presenter affiliation',
  presenter_name: 'Presenter name',
  presenter_affiliation: 'Presenter affiliation',
};

const EXTRACTION_STATUS_LABELS = {
  success: 'Automatic extraction completed',
  fallback: 'Manual-entry fallback used',
};

const EXTRACTION_REASON_LABELS = {
  access_denied: 'The extraction service denied access.',
  demo_mode: 'Automatic extraction is disabled in demo mode.',
  invalid_request: 'The extraction request was invalid.',
  malformed_response: 'The extraction service returned an unreadable response.',
  not_configured: 'The extraction service is not configured.',
  oversized_input: 'The source was too large to process.',
  provider_unavailable: 'The extraction service was unavailable or rejected its credentials.',
  rate_limited: 'The extraction request was rate limited.',
  remote_source_unavailable: 'The securely uploaded source was unavailable.',
  source_unavailable: 'The source could not be retrieved for extraction.',
  throttled: 'The extraction service temporarily throttled the request.',
  timeout: 'The extraction request timed out.',
  unsupported_input: 'The source format could not be processed.',
};

function emptyFields(viewer, type) {
  return {
    title: '',
    org: type === 'event' ? '' : (viewer.role?.org || ''),
    subtype: type === 'event' ? 'Workshop' : 'Internship',
    paid: false,
    compensationType: '',
    classifications: [],
    workMode: '',
    description: '',
    eligibility: '',
    date: '',
    endDate: '',
    time: '',
    deadline: '',
    deadlineType: 'specific_date',
    postedDate: '',
    location: '',
    link: '',
    contactName: '',
    contactEmail: '',
    majors: ['All majors'],
    source: viewer.role?.org || 'C.O.D.E.',
    announcementCategory: 'General',
    sourceUrl: '',
    body: '',
    presenterName: '',
    presenterAffiliation: '',
  };
}

function mb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function validateClientFile(file) {
  const allowed = ['application/pdf', 'image/png', 'image/jpeg'];
  if (!allowed.includes(file.type)) {
    throw new Error(`${file.name} is not a supported PDF, PNG, JPG, or JPEG.`);
  }
  const extension = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : '';
  const validExtension = file.type === 'application/pdf' ? extension === 'pdf' : (file.type === 'image/png' ? extension === 'png' : ['jpg', 'jpeg'].includes(extension));
  if (!validExtension) throw new Error(`${file.name} has an extension that does not match its file type.`);
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

const FEEDBACK_RATINGS = [
  ['accurate', 'Accurate'],
  ['minor_edits', 'Needed minor edits'],
  ['major_edits', 'Needed major edits'],
  ['failed', 'Extraction failed'],
];
const FEEDBACK_ISSUES = [
  ['title', 'Title'], ['date', 'Date'], ['time', 'Time'], ['location', 'Location'],
  ['organization', 'Organization'], ['contact', 'Contact'], ['deadline', 'Deadline'],
  ['source_link', 'Source link'], ['description', 'Description'], ['other', 'Other'],
];

export default function PantherSubmitForm({ viewer, feedbackEnabled = true, initialContentType = '' }) {
  const router = useRouter();
  const [step, setStep] = useState(initialContentType ? 2 : 1);
  const [contentType, setContentType] = useState(initialContentType);
  const [relationship, setRelationship] = useState('');
  const [referral, setReferral] = useState({ name: '', title: '', organization: '', email: '', mayDisplay: false, relationship: '', graduationYear: '', organizerRole: '' });
  const [organizationChoice, setOrganizationChoice] = useState('');
  const [artifacts, setArtifacts] = useState([]);
  const [nextSourceType, setNextSourceType] = useState('screenshot');
  const [pastedText, setPastedText] = useState('');
  const [parseResult, setParseResult] = useState(null);
  const [fields, setFields] = useState(() => emptyFields(viewer, initialContentType || 'opportunity'));
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedIntakeId, setSubmittedIntakeId] = useState('');
  const [feedback, setFeedback] = useState({ rating: '', issueFields: [], note: '' });
  const [feedbackStatus, setFeedbackStatus] = useState('');
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [contactConfirmed, setContactConfirmed] = useState(false);
  const [useSubmitterAsContact, setUseSubmitterAsContact] = useState(false);
  const [noPublicContact, setNoPublicContact] = useState(false);
  const [acknowledgmentAccepted, setAcknowledgmentAccepted] = useState(false);
  const [failedIntake, setFailedIntake] = useState(null);
  const [preparedIntake, setPreparedIntake] = useState(null);

  const combinedBytes = useMemo(() => artifacts.reduce((sum, artifact) => sum + artifact.file.size, 0), [artifacts]);
  const canViewTechnical = viewer.role?.role === 'super_admin';
  const hasExtractedDetails = useMemo(() => {
    if (!parseResult) return false;
    const extractedFields = Object.values(parseResult.fields || {}).some((value) => String(value || '').trim());
    const extractedTags = Object.values(parseResult.tags || {}).some((value) => Array.isArray(value) ? value.length > 0 : Boolean(value));
    return extractedFields || extractedTags;
  }, [parseResult]);
  const missingRequired = useMemo(() => {
    const required = contentType === 'event'
      ? [['title', fields.title], ['hosting organization', fields.org], ['event date', fields.date], ['description', fields.description]]
      : contentType === 'opportunity'
        ? [['title', fields.title], ['organization', fields.org], ...((fields.deadlineType || 'specific_date') === 'specific_date' ? [['deadline', fields.deadline]] : []), ['description', fields.description], ['application link', fields.link], ['compensation', fields.compensationType]]
        : [['title', fields.title], ['announcement', fields.body]];
    return required.filter(([, value]) => !String(value || '').trim()).map(([label]) => label);
  }, [contentType, fields]);
  const extractionState = useMemo(() => {
    if (!parseResult) return null;
    if (!hasExtractedDetails) return 'failure';
    return missingRequired.length ? 'partial' : 'success';
  }, [hasExtractedDetails, missingRequired.length, parseResult]);
  const extractionNotice = useMemo(() => {
    if (extractionState === 'failure') return 'We couldn’t read enough information from this source. Please enter the details below.';
    if (extractionState === 'partial') return `We filled in what we could from your source. Please check and add: ${missingRequired.join(', ')}.`;
    if (extractionState === 'success') return 'We filled in details from your source. Review them below before submitting.';
    return '';
  }, [extractionState, missingRequired]);
  const relationshipComplete = useMemo(() => {
    if (!relationship) return false;
    if (['alumni', 'organizer_host', 'general_contributor'].includes(relationship)) return true;
    if (relationship === 'other') return Boolean(referral.relationship.trim());
    return Boolean(referral.organization.trim() && referral.title.trim());
  }, [relationship, referral]);
  const peopleComplete = relationshipComplete
    && (contentType === 'announcement' || Boolean(fields.org.trim()));

  function chooseType(type) {
    artifacts.forEach((artifact) => {
      if (artifact.previewUrl) URL.revokeObjectURL(artifact.previewUrl);
    });
    setContentType(type);
    setFields(emptyFields(viewer, type));
    setArtifacts([]);
    setPastedText('');
    setParseResult(null);
    setPreparedIntake(null);
    setProgress(null);
    setError('');
    setRelationship('');
    setReferral({ name: '', title: '', organization: '', email: '', mayDisplay: false, relationship: '', graduationYear: '', organizerRole: '' });
    setOrganizationChoice('');
    setContactConfirmed(false);
    setUseSubmitterAsContact(false);
    setNoPublicContact(false);
    setAcknowledgmentAccepted(false);
    setStep(2);
  }

  function updateField(name, value) {
    setFields((current) => ({ ...current, [name]: value }));
  }

  function updateOpportunityType(value) {
    setFields((current) => ({
      ...current,
      subtype: value,
      classifications: value === 'Full-Time' && (current.subtype !== 'Full-Time' || current.classifications.includes('All classifications'))
        ? [...FULL_TIME_DEFAULT_CLASSIFICATIONS]
        : current.classifications,
    }));
  }

  function updateDeadlineType(value) {
    setFields((current) => ({ ...current, deadlineType: value, deadline: value === 'specific_date' ? current.deadline : '' }));
  }

  function updateReferral(name, value) {
    setReferral((current) => ({ ...current, [name]: value }));
  }

  function toggleSubmitterContact(checked) {
    setUseSubmitterAsContact(checked);
    if (checked) setNoPublicContact(false);
    if (checked) {
      setFields((current) => ({ ...current, contactName: viewer.role?.full_name || '', contactEmail: viewer.user?.email || '' }));
      setContactConfirmed(Boolean(viewer.user?.email));
      return;
    }
    setFields((current) => ({
      ...current,
      contactName: current.contactName === (viewer.role?.full_name || '') ? '' : current.contactName,
      contactEmail: current.contactEmail === (viewer.user?.email || '') ? '' : current.contactEmail,
    }));
    setContactConfirmed(false);
  }

  function toggleNoPublicContact(checked) {
    setNoPublicContact(checked);
    if (checked) {
      setUseSubmitterAsContact(false);
      setFields((current) => ({ ...current, contactName: '', contactEmail: '' }));
      setContactConfirmed(false);
    }
  }

  function toggleMajor(major) {
    setFields((current) => {
      if (major === 'All majors') return { ...current, majors: ['All majors'] };
      const selected = current.majors.includes(major);
      let majors = selected
        ? current.majors.filter((value) => value !== major)
        : [...current.majors.filter((value) => value !== 'All majors'), major];
      if (!majors.length) majors = ['All majors'];
      return { ...current, majors };
    });
  }

  function toggleClassification(classification) {
    setFields((current) => {
      if (classification === 'All classifications') {
        return { ...current, classifications: ['All classifications'] };
      }
      const selected = current.classifications.includes(classification);
      let classifications = selected
        ? current.classifications.filter((value) => value !== classification)
        : [...current.classifications.filter((value) => value !== 'All classifications'), classification];
      if (!classifications.length) classifications = ['All classifications'];
      return { ...current, classifications };
    });
  }

  function invalidatePreparedIntake({ resetExtractedFields = false } = {}) {
    if (preparedIntake?.intakeSessionId && !preparedIntake.demo) {
      void abandonIntakeAction(preparedIntake.intakeSessionId);
    }
    setPreparedIntake(null);
    setParseResult(null);
    setProgress(null);
    setFailedIntake(null);
    setFeedbackStatus('');
    if (resetExtractedFields) {
      setFields(emptyFields(viewer, contentType || 'opportunity'));
      setOrganizationChoice('');
      setContactConfirmed(false);
      setUseSubmitterAsContact(false);
      setAcknowledgmentAccepted(false);
    }
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
        previewUrl: URL.createObjectURL(file),
      }));
      const total = combinedBytes + incoming.reduce((sum, item) => sum + item.file.size, 0);
      if (total > 25 * 1024 * 1024) throw new Error('The combined source files exceed 25 MB. Remove a file or upload smaller copies.');
      invalidatePreparedIntake({ resetExtractedFields: true });
      setArtifacts((current) => [...current, ...incoming]);
    } catch (reason) {
      setError(reason.message);
    } finally {
      event.target.value = '';
    }
  }

  function removeArtifact(id) {
    invalidatePreparedIntake({ resetExtractedFields: true });
    setError('');
    setArtifacts((current) => {
      const removed = current.find((artifact) => artifact.id === id);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((artifact) => artifact.id !== id);
    });
  }

  function sourceFingerprint() {
    return JSON.stringify({
      files: artifacts.map((artifact) => [artifact.id, artifact.file.name, artifact.file.size, artifact.file.type]),
      pastedText,
    });
  }

  async function createAndUploadIntake({ provisional = false } = {}) {
    const intake = await beginIntakeAction({
      contentType,
      provisional,
      relationshipToSource: provisional ? 'other' : RELATIONSHIP_STORAGE[relationship],
      relationshipDetails: provisional ? {} : {
        category: relationship,
        roleOrPosition: referral.title,
        affiliation: referral.organization,
        relationshipToSubmission: referral.relationship,
        graduationYear: referral.graduationYear || null,
        organizerRole: referral.organizerRole || null,
      },
      referral: provisional ? {} : referral,
      pastedText,
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
          .uploadToSignedUrl(upload.path, upload.token, artifact.file, { contentType: artifact.file.type });
        if (uploadError) {
          await abandonIntakeAction(intake.intakeSessionId);
          throw new Error(`${artifact.name} could not be uploaded securely. Please try again.`);
        }
      }
    }

    return {
      intakeSessionId: intake.intakeSessionId,
      sourceIds: Object.fromEntries((intake.sources || []).map((source) => [source.clientId, source.artifactId])),
      fingerprint: sourceFingerprint(),
      demo: Boolean(intake.demo),
    };
  }

  async function extract() {
    if (!artifacts.length && !pastedText.trim()) {
      setError('');
      setParseResult(null);
      setStep(3);
      return;
    }
    setError('');
    setProgress({ source: 'Preparing sources', progress: 0 });
    try {
      if (preparedIntake?.intakeSessionId && !preparedIntake.demo) {
        await abandonIntakeAction(preparedIntake.intakeSessionId);
      }
      let draft = null;
      try {
        draft = await createAndUploadIntake({ provisional: true });
        setPreparedIntake(draft);
      } catch {
        setPreparedIntake(null);
      }
      const extraction = await extractSubmission({
        contentType,
        artifacts,
        pastedText,
        intakeSessionId: draft?.intakeSessionId || null,
        onProgress: setProgress,
      });
      const parsedResult = toSubmissionParserResult(extraction);
      const result = canViewTechnical ? parsedResult : { ...parsedResult, technical: {} };
      setParseResult(result);
      if (result.fields.organization) setOrganizationChoice(APPROVED_ORGANIZATIONS.includes(result.fields.organization) ? result.fields.organization : 'other');
      const extractedClassifications = normalizeOpportunityClassifications(result.tags.classifications);
      const extractedEligibility = result.fields.eligibility
        || result.tags.qualifications.join('; ')
        || extractedClassifications.join(', ');
      const extractedSubtype = result.tags.categories[0] && (contentType === 'event' ? EVENT_TYPES : OPPORTUNITY_TYPES).includes(result.tags.categories[0])
        ? result.tags.categories[0]
        : null;
      setFields((current) => ({
        ...current,
        title: result.fields.title || current.title,
        org: result.fields.organization || current.org,
        description: result.fields.description || current.description,
        body: contentType === 'announcement' ? (result.fields.description || current.body) : current.body,
        eligibility: extractedEligibility || current.eligibility,
        date: result.fields.date || current.date,
        time: result.fields.time || current.time,
        deadline: result.fields.deadline || current.deadline,
        postedDate: result.fields.postedDate || current.postedDate,
        deadlineType: contentType === 'opportunity'
          ? (result.fields.deadlineType || (result.fields.deadline ? 'specific_date' : current.deadlineType))
          : current.deadlineType,
        location: result.fields.location || current.location,
        link: result.fields.link || current.link,
        paid: result.tags.compensation === 'Paid' || current.paid,
        compensationType: ['Paid', 'Unpaid'].includes(result.tags.compensation) ? result.tags.compensation : current.compensationType,
        classifications: extractedClassifications.length
          ? extractedClassifications
          : extractedSubtype === 'Full-Time' ? [...FULL_TIME_DEFAULT_CLASSIFICATIONS] : current.classifications,
        workMode: result.tags.workModes[0] || current.workMode,
        subtype: extractedSubtype || current.subtype,
        majors: result.tags.majors.length ? result.tags.majors : current.majors,
        contactName: result.fields.contactName || current.contactName,
        contactEmail: result.fields.contactEmail || current.contactEmail,
        presenterName: result.fields.presenterName || current.presenterName,
        presenterAffiliation: result.fields.presenterAffiliation || current.presenterAffiliation,
      }));
      setStep(3);
    } catch (reason) {
      setError(reason.message || 'The sources could not be processed. You can continue manually.');
      setStep(3);
    } finally {
      setProgress(null);
    }
  }

  function buildPayload(flyerUrl = null) {
    if (contentType === 'announcement') {
      return { source: fields.source, title: fields.title, body: fields.body, category: fields.announcementCategory, source_url: fields.sourceUrl || null, pinned: false };
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
          end_date: fields.endDate || null,
          time: fields.time,
          registration_link: fields.link || null,
          presenter_name: fields.presenterName || null,
          presenter_affiliation: fields.presenterAffiliation || null,
        }
      : { ...common, eligibility: fields.eligibility || null, paid: fields.compensationType === 'Paid', compensation_type: fields.compensationType, classifications: fields.classifications, work_mode: fields.workMode || null, deadline_type: fields.deadlineType, deadline: fields.deadlineType === 'specific_date' ? fields.deadline : null, posted_date: fields.postedDate || null, link: fields.link };
  }

  async function submit(event) {
    event.preventDefault();
    if (contentType === 'event' && !acknowledgmentAccepted) {
      setError('Confirm the submission acknowledgment before submitting this event.');
      return;
    }
    if (contentType !== 'announcement' && fields.contactEmail && !contactConfirmed) {
      setError('Confirm the public contact information before submitting.');
      return;
    }
    setSubmitting(true);
    setError('');
    setFailedIntake(null);
    try {
      let intake = preparedIntake;
      if (!intake || intake.fingerprint !== sourceFingerprint()) {
        if (intake?.intakeSessionId && !intake.demo) await abandonIntakeAction(intake.intakeSessionId);
        intake = await createAndUploadIntake();
        setPreparedIntake(intake);
      }
      const sourceIds = intake.sourceIds || {};

      const finalized = await finalizeIntakeAction({
        intakeSessionId: intake.intakeSessionId,
        contentType,
        relationshipToSource: RELATIONSHIP_STORAGE[relationship],
        relationshipDetails: {
          category: relationship,
          roleOrPosition: referral.title,
          affiliation: referral.organization,
          relationshipToSubmission: referral.relationship,
          graduationYear: referral.graduationYear || null,
          organizerRole: referral.organizerRole || null,
        },
        referral,
        payload: buildPayload(null),
        suggestions: Object.fromEntries(Object.entries(parseResult?.provenance || {}).map(([field, suggestion]) => [field, { ...suggestion, sourceArtifactId: sourceIds[suggestion.sourceArtifactId] || suggestion.sourceArtifactId || null }])),
        sourceResults: (parseResult?.source?.processed || []).map(result => ({
          sourceArtifactId: sourceIds[result.artifactId] || result.artifactId || null,
          status: result.status === 'failed' ? 'failed' : (parseResult?.warnings?.some(warning => warning.artifactId === result.artifactId) ? 'needs_review' : 'processed'),
          pageCount: result.pageCount,
          warnings: (parseResult?.warnings || []).filter(warning => warning.artifactId === result.artifactId).map(warning => warning.message),
        })),
        confirmedValues: fields,
        acknowledgmentAccepted,
      });
      if (!finalized.ok) {
        if (finalized.retained) setFailedIntake({ intakeSessionId: intake.intakeSessionId });
        throw new Error(finalized.error);
      }
      setSubmittedIntakeId(intake.intakeSessionId);
      setPreparedIntake(null);
      setStep(6);
      setSubmitted(true);
      router.refresh();
    } catch (reason) {
      setError(reason.message || 'The submission could not be completed.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    async function saveFeedback(event) {
      event.preventDefault();
      setFeedbackSaving(true);
      const result = await saveParserFeedbackAction({ intakeSessionId: submittedIntakeId, ...feedback });
      setFeedbackSaving(false);
      setFeedbackStatus(result.ok ? 'Thank you. Your optional parser feedback was saved.' : (result.error || 'Feedback was not saved. Your submission is still complete.'));
    }
    function toggleFeedbackIssue(field) {
      setFeedback((current) => ({ ...current, issueFields: current.issueFields.includes(field) ? current.issueFields.filter((item) => item !== field) : [...current.issueFields, field] }));
    }
    return (
      <div className="max-w-2xl mx-auto mt-16 bg-white border border-line rounded-2xl p-8">
        <div className="font-display text-xl text-purple-900">Submitted for review</div>
        <p className="text-sm text-slate mt-2">
          Panther Hub received “{fields.title}.” Nothing is published until an authorized reviewer approves it.
          {isDemoMode && ' This was a demo submission and was not saved.'}
        </p>
        <p className="text-sm text-slate mt-2">You can return to check its status. A reviewer may ask you to correct missing or unclear information.</p>
        <div className="submission-success-actions"><button type="button" className="outline-button" onClick={() => { router.refresh(); document.getElementById('submission-status')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>View submission status</button><a href="/panther-submit" className="gold-button">Submit another</a></div>
        {feedbackEnabled && <form onSubmit={saveFeedback} className="parser-feedback mt-6 border-t border-line pt-5">
          <h2 className="font-display text-lg text-purple-900">Optional: parser quality feedback</h2>
          <p className="text-xs text-slate mt-1">Super Admin feedback helps us improve extraction. Note what the parser handled well, what it missed, or what required manual correction. This does not change your completed submission.</p>
          <fieldset className="mt-4"><legend className="text-sm font-medium">Overall result</legend><div className="flex flex-wrap gap-2 mt-2">
            {FEEDBACK_RATINGS.map(([value, label]) => <label key={value} className="chip"><input type="radio" name="parser-rating" value={value} checked={feedback.rating === value} onChange={() => setFeedback((current) => ({ ...current, rating: value }))} /> {label}</label>)}
          </div></fieldset>
          <fieldset className="mt-4"><legend className="text-sm font-medium">What needed attention? <span className="text-slate font-normal">(choose any)</span></legend><div className="flex flex-wrap gap-2 mt-2">
            {FEEDBACK_ISSUES.map(([value, label]) => <label key={value} className="chip"><input type="checkbox" checked={feedback.issueFields.includes(value)} onChange={() => toggleFeedbackIssue(value)} /> {label}</label>)}
          </div></fieldset>
          <label className="parser-feedback-note"><span>What it handled well / where it struggled <small>(optional, 500 characters)</small></span><textarea rows={5} maxLength={500} value={feedback.note} onChange={(event) => setFeedback((current) => ({ ...current, note: event.target.value }))} placeholder="Describe what worked, what was missed, or what needed correction. Do not paste private source text." /></label>
          <button className="gold-button mt-4" type="submit" disabled={!feedback.rating || feedbackSaving}>{feedbackSaving ? 'Saving…' : 'Send optional feedback'}</button>
          {feedbackStatus && <p className="text-xs text-slate mt-3" role="status" aria-live="polite">{feedbackStatus}</p>}
        </form>}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <header className="mt-9 mb-8">
        <div className="font-mono text-xs uppercase tracking-wider text-gold-600">Contributor submission</div>
        <h1 className="font-display text-3xl text-purple-900 mt-1">Share something useful with students</h1>
        <p className="text-sm text-slate mt-2">Add what you already have. Panther Hub will suggest details and ask only for what is missing.</p>
      </header>

      <div className="submission-progress mb-8" aria-label="Submission progress">
        {['Type', 'Source', 'Details', 'People', 'Review', 'Submit'].map((label, index) => (
          <div key={label} aria-current={step === index + 1 ? 'step' : undefined} className={`rounded-lg px-3 py-2 text-xs font-mono ${step >= index + 1 ? 'bg-purple-900 text-white' : 'bg-white border border-line text-slate'}`}>
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

      {step === 4 && (
        <Panel title="People connected to this submission">
          <section className="submission-identity-section" aria-labelledby="submitted-by-title">
            <div className="eyebrow" id="submitted-by-title">Submitted by</div>
            <p className="submission-identity-help">This is you—the person sending the information to the Hub. The organizer may be someone else.</p>
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <Input label="Your name" value={viewer.role?.full_name || 'Name not added yet'} readOnly />
              <Input label="Your email" type="email" value={viewer.user?.email || ''} readOnly />
            </div>
            {!viewer.role?.full_name && <WorkspaceIdentityForm email={viewer.user?.email} />}
            <label className="block mt-4">
              <span className="text-sm font-medium block mb-1.5">How are you connected? <span className="text-coral">*</span></span>
              <select className="input" required value={relationship} onChange={(event) => { setRelationship(event.target.value); setReferral((current) => ({ ...current, title: '', organization: '', relationship: '', graduationYear: '', organizerRole: '' })); }}>
                <option value="">Choose one</option>
                {RELATIONSHIPS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </label>
            {relationship && <RelationshipFields relationship={relationship} referral={referral} updateReferral={updateReferral} />}
          </section>

          {contentType !== 'announcement' && <>
            <section className="submission-identity-section" aria-labelledby="organizer-title">
              <div className="eyebrow" id="organizer-title">{contentType === 'event' ? 'Event host' : 'Employer / offering organization'}</div>
              <p className="submission-identity-help">{contentType === 'event' ? 'Who is hosting this event?' : 'Who is offering this opportunity?'} This is separate from the person submitting it.</p>
              <p className="mt-3"><strong>{fields.org}</strong></p>
            </section>
            <section className="submission-identity-section" aria-labelledby="public-contact-title">
              <div className="eyebrow" id="public-contact-title">{contentType === 'event' ? 'Event contact' : 'Opportunity contact'}</div>
              <p className="submission-identity-help">Who can students contact about this {contentType}?</p>
              <label className="flex items-start gap-2 mt-4 text-sm"><input type="checkbox" checked={useSubmitterAsContact} onChange={(event) => toggleSubmitterContact(event.target.checked)} /><span>Use me as the public contact</span></label>
              {contentType === 'opportunity' && <label className="flex items-start gap-2 mt-3 text-sm"><input type="checkbox" checked={noPublicContact} onChange={(event) => toggleNoPublicContact(event.target.checked)} /><span>No public opportunity contact available</span></label>}
              {!useSubmitterAsContact && !noPublicContact && <div className="grid md:grid-cols-2 gap-4 mt-4">
                <Input label="Contact name (optional)" value={fields.contactName} onChange={(value) => updateField('contactName', value)} />
                <Input label="Contact email (optional)" type="email" value={fields.contactEmail} onChange={(value) => { updateField('contactEmail', value); setContactConfirmed(false); }} />
              </div>}
            </section>
          </>}
          <Navigation back={() => setStep(3)} next={() => setStep(5)} nextDisabled={!peopleComplete} />
        </Panel>
      )}

      {step === 2 && (
        <Panel title="Add your source">
          <p className="text-sm text-slate mb-5">
            Upload a PDF or screenshot, or paste the details directly. Accepted files: PDF, PNG, JPG/JPEG.
          </p>
          <div className="grid md:grid-cols-[1fr_auto] gap-3">
            <select value={nextSourceType} onChange={(event) => setNextSourceType(event.target.value)} className="input">
              {SOURCE_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <label className="bg-purple-900 text-white rounded-lg px-5 py-3 text-sm cursor-pointer text-center">
              Add source file
              <input id="submission-source-file" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" className="hidden" onChange={addFiles} />
            </label>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            {artifacts.map((artifact) => (
              <div key={artifact.id} className="flex flex-wrap items-center justify-between gap-3 border border-line rounded-lg px-4 py-3 bg-paper">
                <div>
                  <div className="text-sm font-medium">{artifact.name}</div>
                  <div className="text-xs text-slate">Ready to process · {mb(artifact.file.size)}</div>
                </div>
                <div className="flex flex-wrap gap-3"><a className="text-xs text-purple-700" href={artifact.previewUrl} target="_blank" rel="noreferrer">View original</a><button type="button" className="text-xs text-coral" aria-label={`Remove ${artifact.name}`} onClick={() => removeArtifact(artifact.id)}>Remove source</button></div>
              </div>
            ))}
          </div>

          <label className="block mt-5">
            <span className="text-sm font-medium block mb-1.5">Paste email or posting text</span>
            <textarea value={pastedText} onChange={(event) => { invalidatePreparedIntake({ resetExtractedFields: true }); setPastedText(event.target.value); }} rows={6} className="input" placeholder="Paste the relevant message or posting text. Unrelated email history is not needed." />
          </label>

          {progress && <div className="mt-4 text-xs text-purple-700">Processing {progress.source} — {Math.round((progress.progress || 0) * 100)}%</div>}
          <Navigation back={() => setStep(1)} next={extract} nextLabel={artifacts.length || pastedText.trim() ? 'Review what the Hub found' : 'Continue manually'} />
        </Panel>
      )}

      {step === 3 && (
        <div>
          <Panel title="What the Hub found">
            {extractionNotice && <Notice>{extractionNotice}</Notice>}
            {parseResult?.conflicts?.length > 0 && <p className="text-sm text-slate mb-4">Some sources contained different information. Choose the value that should be reviewed below.</p>}

            <div className={`grid gap-4 ${contentType === 'event' ? '' : 'md:grid-cols-2'}`}>
              <Input label="Title" required value={fields.title} onChange={(value) => updateField('title', value)} />
              {contentType !== 'event' && <Input label={contentType === 'announcement' ? 'Source' : 'Organization, employer, or host'} required value={contentType === 'announcement' ? fields.source : fields.org} onChange={(value) => updateField(contentType === 'announcement' ? 'source' : 'org', value)} />}
            </div>

            {contentType === 'announcement' ? (
              <>
                <div className="grid md:grid-cols-2 gap-4 mt-4">
                  <label><span className="text-sm font-medium block mb-1.5">Category</span><select className="input" value={fields.announcementCategory} onChange={(event) => updateField('announcementCategory', event.target.value)}>{ANNOUNCEMENT_CATEGORIES.map((value) => <option key={value}>{value}</option>)}</select></label>
                  <Input label="Official source link (optional)" type="url" value={fields.sourceUrl} onChange={(value) => updateField('sourceUrl', value)} placeholder="https://…" />
                </div>
                <label className="block mt-4"><span className="text-sm font-medium block mb-1.5">Announcement</span><textarea required className="input" rows={6} value={fields.body} onChange={(event) => updateField('body', event.target.value)} /></label>
              </>
            ) : (
              <>
                <label className="block mt-4"><span className="text-sm font-medium block mb-1.5">Description</span><textarea required className="input" rows={6} value={fields.description} onChange={(event) => updateField('description', event.target.value)} /></label>
                {contentType === 'opportunity' && <label className="block mt-4"><span className="text-sm font-medium block mb-1.5">Eligibility and requirements</span><textarea className="input" rows={4} value={fields.eligibility} onChange={(event) => updateField('eligibility', event.target.value)} placeholder="Who is eligible, required experience, GPA, work authorization, or other qualifications" /></label>}
                <div className="grid md:grid-cols-2 gap-4 mt-4">
                  <label><span className="text-sm font-medium block mb-1.5">Category</span><select className="input" value={fields.subtype} onChange={(event) => contentType === 'opportunity' ? updateOpportunityType(event.target.value) : updateField('subtype', event.target.value)}>{(contentType === 'event' ? EVENT_TYPES : OPPORTUNITY_TYPES).map((value) => <option key={value}>{value}</option>)}</select></label>
                  {contentType === 'event' && <Input label="Event start date" type="date" required value={fields.date} onChange={(value) => updateField('date', value)} />}
                  {contentType === 'opportunity' && <label><span className="text-sm font-medium block mb-1.5">Deadline</span><select className="input" value={fields.deadlineType} onChange={(event) => updateDeadlineType(event.target.value)}>{SUBMISSION_DEADLINE_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
                  {contentType === 'opportunity' && fields.deadlineType === 'specific_date' && <Input label="Application deadline" type="date" required value={fields.deadline} onChange={(value) => updateField('deadline', value)} />}
                  {contentType === 'opportunity' && fields.deadlineType === 'rolling' && <Input label="Original posting date (optional)" type="date" value={fields.postedDate} onChange={(value) => updateField('postedDate', value)} />}
                  {contentType === 'event' && <Input label="Event end date (optional)" type="date" min={fields.date || undefined} value={fields.endDate} onChange={(value) => updateField('endDate', value)} />}
                  {contentType === 'event' && <Input label="Time" value={fields.time} onChange={(value) => updateField('time', value)} placeholder="4:00–5:15 PM" />}
                  <Input label={contentType === 'opportunity' && fields.workMode && fields.workMode !== 'Remote' ? 'Location (required)' : 'Location'} required={contentType === 'opportunity' && Boolean(fields.workMode) && fields.workMode !== 'Remote'} value={fields.location} onChange={(value) => updateField('location', value)} />
                  <Input label={contentType === 'event' ? 'Registration link' : 'Application link'} type="url" required={contentType === 'opportunity'} value={fields.link} onChange={(value) => updateField('link', value)} />
                </div>
                {contentType === 'event' && <section className="submission-identity-section mt-5" aria-labelledby="confirm-organizer-title">
                  <div className="eyebrow" id="confirm-organizer-title">Event host</div>
                  <div className="mt-4"><OrganizationSelect choice={organizationChoice} setChoice={setOrganizationChoice} value={fields.org} onChange={(value) => updateField('org', value)} /></div>
                </section>}
                {contentType === 'opportunity' && <div className="grid md:grid-cols-2 gap-4 mt-4"><label><span className="text-sm font-medium block mb-1.5">Work format</span><select className="input" value={fields.workMode} onChange={(event) => updateField('workMode', event.target.value)}><option value="">Not specified</option>{WORK_MODES.map((value) => <option key={value}>{value}</option>)}</select></label><label><span className="text-sm font-medium block mb-1.5">Compensation <span className="text-coral">*</span></span><select required className="input" value={fields.compensationType} onChange={(event) => { updateField('compensationType', event.target.value); updateField('paid', event.target.value === 'Paid'); }}><option value="" disabled>Select compensation</option>{COMPENSATION_TYPES.map((value) => <option key={value}>{value}</option>)}</select></label></div>}
                <div className="mt-5"><div className="text-sm font-medium mb-2">Eligible majors</div><div className="flex flex-wrap gap-2">{MAJORS.map((major) => <button type="button" key={major} onClick={() => toggleMajor(major)} className={`text-xs rounded-full px-3 py-1.5 border ${fields.majors.includes(major) ? 'bg-purple-900 text-white border-purple-900' : 'border-line'}`}>{major}</button>)}</div></div>
                {contentType === 'opportunity' && <div className="mt-5"><div className="text-sm font-medium mb-2">Eligible classifications</div><div className="flex flex-wrap gap-2">{CLASSIFICATIONS.map((classification) => <button type="button" key={classification} onClick={() => toggleClassification(classification)} className={'text-xs rounded-full px-3 py-1.5 border ' + (fields.classifications.includes(classification) ? 'bg-purple-900 text-white border-purple-900' : 'border-line')}>{classification}</button>)}</div></div>}
              </>
            )}

            <div className="flex justify-between items-center mt-7 pt-5 border-t border-line">
              <button type="button" className="text-sm text-purple-700" onClick={() => setStep(2)}>Back to source</button>
              <button type="button" disabled={missingRequired.length > 0} className="bg-purple-900 text-white rounded-lg px-5 py-2.5 text-sm disabled:opacity-40" onClick={() => setStep(4)}>Continue</button>
            </div>
          </Panel>
        </div>
      )}

      {step === 5 && (
        <form onSubmit={submit}>
          <Panel title="Final review">
            <p className="text-sm text-slate mb-5">Submitting sends this information to the C.O.D.E. team for review. It will not be visible to students until approved.</p>
            <dl className="submission-final-summary">
              <div><dt>You’re submitting</dt><dd>{fields.title || 'Title missing'}</dd></div>
              {contentType !== 'announcement' && <div><dt>Hosted by</dt><dd>{fields.org || 'Organization missing'}</dd></div>}
              <div><dt>{contentType === 'event' ? 'Date' : contentType === 'opportunity' ? 'Deadline' : 'Content type'}</dt><dd>{contentType === 'event' ? fields.date : contentType === 'opportunity' ? deadlineLabel(fields.deadlineType, fields.deadline) : 'Hub announcement'}</dd></div>
              <div><dt>Submitted by</dt><dd>{viewer.role?.full_name || viewer.user?.email}</dd></div>
            </dl>
            {contentType === 'event' && <section className="submission-acknowledgment" aria-labelledby="submission-acknowledgment-title">
              <div className="eyebrow" id="submission-acknowledgment-title">Before you submit</div>
              <p>{SUBMISSION_ACKNOWLEDGMENT}</p>
              <label><input type="checkbox" required checked={acknowledgmentAccepted} onChange={(event) => setAcknowledgmentAccepted(event.target.checked)} /><span>I confirm the information I submitted is accurate to the best of my knowledge.</span></label>
            </section>}
            {fields.contactEmail && <label className="flex items-start gap-2 text-xs text-slate bg-purple-100 rounded-lg p-3 mt-5"><input type="checkbox" checked={contactConfirmed} onChange={(event) => setContactConfirmed(event.target.checked)} /><span>I confirm this is the appropriate contact to display publicly. The submitter identity remains separate from the organizer.</span></label>}
            <div className="submission-final-actions">
              <button type="button" className="outline-button" onClick={() => setStep(3)}>Edit information</button>
              <button type="submit" disabled={submitting || (contentType === 'event' && !acknowledgmentAccepted) || (Boolean(fields.contactEmail) && !contactConfirmed)} className="gold-button">{submitting ? 'Submitting…' : 'Submit for review'}</button>
            </div>
          </Panel>
        </form>
      )}

      {error && <div role="alert" className={`submission-error${failedIntake ? ' submission-error-retained' : ''}`}><p>{failedIntake ? "We couldn't create the final submission. Your source information was retained safely, but no content was submitted for review." : error}</p>{failedIntake && <><small>A clean retry will create a new submission attempt. The previous failed attempt remains available to administrators for troubleshooting.</small><button type="button" className="outline-button" onClick={() => { setFailedIntake(null); setError(''); }}>Try again</button></>}</div>}

      <style jsx global>{`.input{width:100%;border:1px solid #E7E2EF;border-radius:8px;padding:10px 13px;font-size:13.5px;font-family:inherit}.input:focus{outline:2px solid #B8912B;outline-offset:1px}`}</style>
    </div>
  );
}

function Panel({ title, children }) {
  return <section className="bg-white border border-line rounded-2xl p-6 md:p-8"><h2 className="font-display text-xl text-purple-900 mb-5">{title}</h2>{children}</section>;
}

function Input({ label, value, onChange, type = 'text', required, placeholder, min, readOnly = false }) {
  return <label className="block"><span className="text-sm font-medium block mb-1.5">{label}{required && <span className="text-coral"> *</span>}</span><input className="input" type={type} required={required} value={value} placeholder={placeholder} min={min} readOnly={readOnly} aria-readonly={readOnly || undefined} onChange={readOnly ? undefined : (event) => onChange(event.target.value)} /></label>;
}

function Navigation({ back, next, nextDisabled, nextLabel = 'Continue' }) {
  return <div className="flex justify-between mt-7 pt-5 border-t border-line"><button type="button" className="text-sm text-purple-700" onClick={back}>Back</button><button type="button" disabled={nextDisabled} className="bg-purple-900 text-white rounded-lg px-5 py-2.5 text-sm disabled:opacity-40" onClick={next}>{nextLabel}</button></div>;
}

function Notice({ children }) {
  return <div className="bg-gold-100 text-ink border border-gold-400 rounded-lg p-3 text-sm mb-3">{children}</div>;
}

function OrganizationSelect({ choice, setChoice, value, onChange }) {
  function changeChoice(nextChoice) {
    setChoice(nextChoice);
    onChange(nextChoice === 'other' ? '' : nextChoice);
  }
  return <div>
    <label className="block"><span className="text-sm font-medium block mb-1.5">Hosting organization <span className="text-coral">*</span></span><select className="input" required value={choice} onChange={(event) => changeChoice(event.target.value)}><option value="">Choose an organization</option>{APPROVED_ORGANIZATIONS.map((organization) => <option key={organization} value={organization}>{organization}</option>)}<option value="other">Other / Not listed</option></select></label>
    {choice === 'other' && <div className="mt-3"><Input label="Organization name" required value={value} onChange={onChange} placeholder="Enter the full official organization name" /></div>}
  </div>;
}

function RelationshipFields({ relationship, referral, updateReferral }) {
  if (relationship === 'student_organization') return <div className="grid md:grid-cols-2 gap-4 mt-4">
    <label><span className="text-sm font-medium block mb-1.5">Registered student organization <span className="text-coral">*</span></span><select className="input" required value={referral.organization} onChange={(event) => updateReferral('organization', event.target.value)}><option value="">Choose an organization</option>{REGISTERED_EVENT_ORGANIZATIONS.map((organization) => <option key={organization.value} value={organization.label}>{organization.label}</option>)}</select></label>
    <Input label="Your role" required value={referral.title} onChange={(value) => updateReferral('title', value)} placeholder="President, officer, member, adviser" />
    <div className="md:col-span-2"><ReportIssueForm label="Report / request an organization addition" defaultIssueType="Organization addition request" /></div>
  </div>;
  if (relationship === 'faculty_staff' || relationship === 'department_college') return <div className="grid md:grid-cols-2 gap-4 mt-4"><Input label={relationship === 'faculty_staff' ? 'Department / office' : 'Department / college'} required value={referral.organization} onChange={(value) => updateReferral('organization', value)} /><Input label="Position or role" required value={referral.title} onChange={(value) => updateReferral('title', value)} /></div>;
  if (relationship === 'alumni') return <div className="grid md:grid-cols-2 gap-4 mt-4"><Input label="Graduation year (optional)" value={referral.graduationYear} onChange={(value) => updateReferral('graduationYear', value)} /><Input label="Current organization / company (optional)" value={referral.organization} onChange={(value) => updateReferral('organization', value)} /></div>;
  if (relationship === 'corporate_industry') return <div className="grid md:grid-cols-2 gap-4 mt-4"><Input label="Company" required value={referral.organization} onChange={(value) => updateReferral('organization', value)} /><Input label="Position" required value={referral.title} onChange={(value) => updateReferral('title', value)} /></div>;
  if (relationship === 'ambassador') return <div className="grid md:grid-cols-2 gap-4 mt-4"><Input label="Organization" required value={referral.organization} onChange={(value) => updateReferral('organization', value)} placeholder="Amazon Web Services" /><Input label="Ambassador role" required value={referral.title} onChange={(value) => updateReferral('title', value)} placeholder="AWS Student Builder Ambassador" /></div>;
  if (relationship === 'organizer_host') return <p className="submission-identity-help mt-4">The event host or opportunity organization is recorded separately below, so no duplicate organizer field is needed here.</p>;
  if (relationship === 'general_contributor') return <div className="mt-4"><Input label="Optional context" value={referral.relationship} onChange={(value) => updateReferral('relationship', value)} placeholder="How you found or verified this information" /></div>;
  return <div className="mt-4"><Input label="How are you connected?" required value={referral.relationship} onChange={(value) => updateReferral('relationship', value)} placeholder="Briefly describe your connection" /></div>;
}
