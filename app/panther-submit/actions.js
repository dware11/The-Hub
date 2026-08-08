'use server';

import { revalidatePath } from 'next/cache';
import { getViewer, isVerifiedContributor } from '../../lib/auth';
import { createServerSupabaseClient, isDemoMode } from '../../lib/supabaseServerClient';
import { validateSubmission } from '../../lib/validation';

const CONTENT_TABLES = Object.freeze({
  opportunity: 'opportunities',
  event: 'events',
  announcement: 'announcements',
});

const RELATIONSHIPS = new Set([
  'original_contact',
  'pvamu_department_referral',
  'student_organization_referral',
  'sponsor_referral',
  'alumni_referral',
  'external_discovery',
  'other',
]);

const SOURCE_TYPES = new Set([
  'flyer',
  'program_pdf',
  'screenshot',
  'email_screenshot',
  'pasted_text',
  'source_link',
  'other',
]);

const MAX_PDF_BYTES = 15 * 1024 * 1024;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_COMBINED_BYTES = 25 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

function cleanText(value, max = 300) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function safeFilename(value) {
  return cleanText(value, 180).replace(/[^a-zA-Z0-9._-]/g, '_') || 'source';
}

function validateArtifactMetadata(artifacts) {
  if (!Array.isArray(artifacts) || artifacts.length > 3) {
    throw new Error('You may add up to three source files.');
  }

  let total = 0;
  return artifacts.map((artifact) => {
    const sourceType = SOURCE_TYPES.has(artifact.sourceType) ? artifact.sourceType : 'other';
    const mimeType = cleanText(artifact.mimeType, 100);
    const byteSize = Number(artifact.byteSize);
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new Error(`${artifact.name || 'A source'} must be a PNG, JPEG, WebP, or PDF.`);
    }
    if (!Number.isSafeInteger(byteSize) || byteSize <= 0) {
      throw new Error(`${artifact.name || 'A source'} has an invalid file size.`);
    }
    const limit = mimeType === 'application/pdf' ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
    if (byteSize > limit) {
      const allowedMb = Math.round(limit / 1024 / 1024);
      throw new Error(
        `${artifact.name || 'This source'} exceeds the ${allowedMb} MB limit. Export a smaller copy, upload a screenshot of the relevant page, paste the text, or enter the details manually.`
      );
    }
    total += byteSize;
    return {
      clientId: cleanText(artifact.clientId, 100),
      sourceType,
      originalFilename: safeFilename(artifact.name),
      mimeType,
      byteSize,
    };
  }).map((artifact) => {
    if (total > MAX_COMBINED_BYTES) {
      throw new Error('The combined source files exceed 25 MB. Remove a file or upload smaller copies.');
    }
    return artifact;
  });
}

async function requireContributor() {
  const viewer = await getViewer();
  if (!viewer.user || !isVerifiedContributor(viewer)) {
    throw new Error('You are not authorized to submit content.');
  }
  return viewer;
}

export async function beginIntakeAction(input) {
  let viewer;
  try {
    viewer = await requireContributor();
  } catch (error) {
    return { ok: false, error: error.message };
  }

  const contentType = CONTENT_TABLES[input?.contentType] ? input.contentType : null;
  if (!contentType) return { ok: false, error: 'Choose a valid content type.' };
  if (!RELATIONSHIPS.has(input?.relationshipToSource)) {
    return { ok: false, error: 'Tell us how this information reached Panther Hub.' };
  }

  let artifacts;
  try {
    artifacts = validateArtifactMetadata(input.artifacts || []);
  } catch (error) {
    return { ok: false, error: error.message };
  }

  if (isDemoMode) {
    return {
      ok: true,
      demo: true,
      intakeSessionId: 'demo-intake-session',
      uploads: [],
    };
  }

  const supabase = await createServerSupabaseClient();
  const { data: session, error: sessionError } = await supabase
    .from('intake_sessions')
    .insert({
      submitter_id: viewer.role.id,
      content_type: contentType,
      relationship_to_source: input.relationshipToSource,
      referral_name: cleanText(input.referral?.name, 200) || null,
      referral_title: cleanText(input.referral?.title, 200) || null,
      referral_organization: cleanText(input.referral?.organization, 200) || null,
      referral_email: cleanText(input.referral?.email, 320).toLowerCase() || null,
      referral_may_display: Boolean(input.referral?.mayDisplay),
      state: 'processing',
    })
    .select('id')
    .single();

  if (sessionError) return { ok: false, error: 'The intake session could not be created.' };

  const uploads = [];
  for (const artifact of artifacts) {
    const artifactId = crypto.randomUUID();
    const storagePath = `${viewer.role.id}/${session.id}/${artifactId}-${artifact.originalFilename}`;
    const { error: artifactError } = await supabase.from('source_artifacts').insert({
      id: artifactId,
      intake_session_id: session.id,
      source_type: artifact.sourceType,
      original_filename: artifact.originalFilename,
      storage_path: storagePath,
      mime_type: artifact.mimeType,
      byte_size: artifact.byteSize,
      processing_status: 'pending',
    });
    if (artifactError) return { ok: false, error: 'Source metadata could not be saved.' };

    const { data: signed, error: signedError } = await supabase.storage
      .from('intake-sources')
      .createSignedUploadUrl(storagePath);
    if (signedError) return { ok: false, error: 'A secure upload could not be prepared.' };

    uploads.push({
      clientId: artifact.clientId,
      artifactId,
      path: signed.path,
      token: signed.token,
    });
  }

  return { ok: true, intakeSessionId: session.id, uploads };
}

export async function finalizeIntakeAction(input) {
  let viewer;
  try {
    viewer = await requireContributor();
  } catch (error) {
    return { ok: false, error: error.message };
  }

  const table = CONTENT_TABLES[input?.contentType];
  if (!table) return { ok: false, error: 'Unknown content type.' };

  let payload;
  try {
    payload = validateSubmission(input.contentType, input.payload);
  } catch (error) {
    return { ok: false, error: error.message };
  }

  if (isDemoMode) return { ok: true, demo: true };
  if (!input.intakeSessionId) return { ok: false, error: 'The intake session is missing.' };

  const supabase = await createServerSupabaseClient();
  const { data: session } = await supabase
    .from('intake_sessions')
    .select('id, submitter_id, state')
    .eq('id', input.intakeSessionId)
    .eq('submitter_id', viewer.role.id)
    .maybeSingle();
  if (!session) return { ok: false, error: 'The intake session could not be verified.' };

  const { data: content, error: contentError } = await supabase
    .from(table)
    .insert({
      ...payload,
      submitted_by: viewer.role.id,
      intake_session_id: session.id,
      status: 'pending',
    })
    .select('id, status')
    .single();

  if (contentError) return { ok: false, error: 'The submission could not be saved.' };

  const suggestionRows = Object.entries(input.suggestions || {}).slice(0, 50).map(([field, suggestion]) => ({
    intake_session_id: session.id,
    source_artifact_id: suggestion?.sourceArtifactId || null,
    field_name: field.slice(0, 100),
    suggested_value: suggestion?.value == null ? null : suggestion.value,
    source_text: cleanText(suggestion?.sourceText, 2000) || null,
    provider: cleanText(suggestion?.provider, 100) || 'local',
    parser_version: cleanText(suggestion?.parserVersion, 100) || 'unknown',
    needs_review: true,
    contributor_value: input.confirmedValues?.[field] ?? null,
    contributor_confirmed_at: new Date().toISOString(),
  }));
  if (suggestionRows.length) await supabase.from('field_suggestions').insert(suggestionRows);

  await supabase
    .from('intake_sessions')
    .update({ state: 'submitted', submitted_at: new Date().toISOString() })
    .eq('id', session.id);

  revalidatePath('/admin/review');
  return { ok: true, data: content };
}
