import { extractIntakeAction } from '../app/panther-submit/actions';
import { parseMultipleSources } from './multiSourceParser';

const REQUIRED_FIELDS = {
  event: ['title', 'organization', 'date', 'description'],
  opportunity: ['title', 'organization', 'description', 'source_url'],
  announcement: ['title', 'description'],
};

const FALLBACK_MESSAGE = "We couldn't automatically read everything from this source. You can still review and enter the information manually.";

function nullable(value) {
  return value == null || value === '' ? null : value;
}

export function normalizeExtractionResult(contentType, result, fallbackReason = null) {
  const fields = result.fields || {};
  const normalized = {
    title: nullable(fields.title),
    organization: nullable(fields.organization),
    date: nullable(fields.date),
    start_time: nullable(fields.time),
    end_time: null,
    deadline: nullable(fields.deadline),
    deadline_type: nullable(fields.deadlineType),
    posted_date: nullable(fields.postedDate),
    location: nullable(fields.location),
    description: nullable(fields.description),
    eligibility: nullable(fields.eligibility),
    contact_name: nullable(fields.contactName),
    contact_email: nullable(fields.contactEmail),
    source_url: nullable(fields.link),
    presenter_name: nullable(fields.presenterName),
    presenter_affiliation: nullable(fields.presenterAffiliation),
  };
  const required = REQUIRED_FIELDS[contentType] || REQUIRED_FIELDS.announcement;
  const missingFields = required.filter((field) => !normalized[field]);
  const warnings = (result.warnings || []).map((warning) => warning.message || String(warning));
  if (fallbackReason && !warnings.includes(FALLBACK_MESSAGE)) warnings.unshift(FALLBACK_MESSAGE);

  return {
    ...normalized,
    missing_fields: missingFields,
    warnings,
    classifications: result.tags || {},
    sources: (result.source?.processed || []).map((source) => ({
      id: source.artifactId,
      name: source.sourceName,
      status: source.status === 'processed' && source.rawText ? 'processed' : 'manual_entry_needed',
      page_count: source.pageCount || null,
    })),
    technical: {
      provider: 'local',
      model: null,
      parser_version: result.parser?.version || 'unknown',
      extraction_status: fallbackReason ? 'fallback' : 'success',
      fallback_reason: fallbackReason,
      confidence: null,
      usage: null,
      provenance: result.provenance || {},
      conflicts: result.conflicts || [],
      uncertain_fields: result.uncertainFields || [],
    },
  };
}

export function toSubmissionParserResult(result) {
  const classifications = result.classifications || {};
  return {
    fields: {
      title: result.title || '',
      organization: result.organization || '',
      date: result.date || '',
      time: [result.start_time, result.end_time].filter(Boolean).join(' – '),
      deadline: result.deadline || '',
      deadlineType: result.deadline_type || '',
      postedDate: result.posted_date || '',
      location: result.location || '',
      description: result.description || '',
      eligibility: result.eligibility || '',
      contactName: result.contact_name || '',
      contactEmail: result.contact_email || '',
      link: result.source_url || '',
      presenterName: result.presenter_name || '',
      presenterAffiliation: result.presenter_affiliation || '',
    },
    tags: {
      categories: classifications.categories || [],
      majors: classifications.majors || [],
      sectors: classifications.sectors || [],
      classifications: classifications.classifications || [],
      qualifications: classifications.qualifications || [],
      workModes: classifications.workModes || [],
      paid: classifications.paid === true,
      compensation: classifications.compensation || 'Not specified',
    },
    provenance: result.technical?.provenance || {},
    source: {
      processed: (result.sources || []).map((source) => ({
        artifactId: source.id,
        sourceName: source.name,
        status: source.status === 'processed' ? 'processed' : 'failed',
        rawText: source.status === 'processed' ? 'Processed' : '',
        pageCount: source.page_count || null,
      })),
    },
    warnings: (result.warnings || []).map((message) => ({ message })),
    conflicts: result.technical?.conflicts || [],
    uncertainFields: result.technical?.uncertain_fields || Object.entries(result.technical?.provenance || {})
      .filter(([, suggestion]) => suggestion.needsReview)
      .map(([field, suggestion]) => ({ field, reason: suggestion.reviewReason || 'Confirm this suggestion against the original source.' })),
    technical: result.technical || {},
  };
}

export async function extractSubmission({ contentType, artifacts, pastedText, intakeSessionId, onProgress }) {
  let fallbackReason = null;
  if (intakeSessionId) {
    onProgress?.({ source: 'Secure extraction', progress: 0.2 });
    try {
      const remote = await extractIntakeAction({ contentType, intakeSessionId });
      if (remote?.ok && remote.result) {
        onProgress?.({ source: 'Secure extraction', progress: 1 });
        return remote.result;
      }
      fallbackReason = remote?.code || 'provider_unavailable';
    } catch {
      fallbackReason = 'provider_unavailable';
    }
  } else {
    fallbackReason = 'remote_source_unavailable';
  }

  const result = await parseMultipleSources({ contentType, artifacts, pastedText, onProgress });
  return normalizeExtractionResult(contentType, result, fallbackReason);
}
