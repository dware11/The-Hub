import { createServerSupabaseClient, isDemoMode } from './supabaseServerClient';

const WINDOWS = Object.freeze({ week: 7, month: 30, all: null });

const demo = Object.freeze({
  week: { available: true, total: 7, ratings: { accurate: 4, minor_edits: 2, major_edits: 1, failed: 0 }, issues: { date: 2, organization: 1, contact: 1 } },
  month: { available: true, total: 18, ratings: { accurate: 9, minor_edits: 6, major_edits: 2, failed: 1 }, issues: { date: 5, contact: 4, source_link: 3 } },
  all: { available: true, total: 31, ratings: { accurate: 16, minor_edits: 9, major_edits: 4, failed: 2 }, issues: { date: 8, contact: 6, organization: 5 } },
});

export async function getParserFeedbackMetrics() {
  if (isDemoMode) return demo;
  try {
    const supabase = await createServerSupabaseClient();
    const entries = await Promise.all(Object.entries(WINDOWS).map(async ([window, days]) => {
      const { data, error } = await supabase.rpc('get_parser_feedback_metrics', { p_days: days });
      return [window, error ? { available: false, total: null, ratings: {}, issues: {} } : { available: true, ...(data || {}) }];
    }));
    return Object.fromEntries(entries);
  } catch {
    return Object.fromEntries(Object.keys(WINDOWS).map((window) => [window, { available: false, total: null, ratings: {}, issues: {} }]));
  }
}

function demoActivity() {
  return [{
    id: 'demo-parser-activity', contentType: 'event', state: 'submitted', createdAt: '2026-09-29T12:00:00Z', submittedAt: '2026-09-29T12:03:00Z',
    submitter: 'Demo Super Admin', sources: [{ type: 'screenshot', filename: 'career-fair.png', status: 'processed', warnings: [] }],
    extractedFields: ['title', 'date', 'location'], reviewFields: ['date'], reviewReasons: ['Confirm the date against the source.'],
    provider: 'amazon-bedrock', parserVersion: 'nova-2-lite-extraction-v1', feedback: { rating: 'minor_edits', issueFields: ['date'], note: 'Title and location were accurate; the date needed correction.' },
  }];
}

export async function getParserActivity(limit = 50) {
  if (isDemoMode) return demoActivity();
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  try {
    const supabase = await createServerSupabaseClient();
    const { data: sessions, error: sessionError } = await supabase
      .from('intake_sessions')
      .select('id, submitter_id, content_type, state, created_at, submitted_at')
      .order('created_at', { ascending: false })
      .limit(safeLimit);
    if (sessionError) throw sessionError;
    const sessionIds = (sessions || []).map((session) => session.id);
    const submitterIds = [...new Set((sessions || []).map((session) => session.submitter_id).filter(Boolean))];
    if (!sessionIds.length) return [];

    const [artifactResult, suggestionResult, feedbackResult, submitterResult] = await Promise.all([
      supabase.from('source_artifacts').select('intake_session_id, source_type, original_filename, mime_type, processing_status, warnings, created_at').in('intake_session_id', sessionIds),
      supabase.from('field_suggestions').select('intake_session_id, field_name, provider, parser_version, confidence, needs_review, review_reason').in('intake_session_id', sessionIds).neq('field_name', 'submission_acknowledgment'),
      supabase.from('intake_parser_feedback').select('intake_session_id, rating, issue_fields, note, updated_at').in('intake_session_id', sessionIds),
      submitterIds.length ? supabase.from('user_roles').select('id, full_name, email').in('id', submitterIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (artifactResult.error || suggestionResult.error || feedbackResult.error || submitterResult.error) throw artifactResult.error || suggestionResult.error || feedbackResult.error || submitterResult.error;

    const group = (rows = []) => rows.reduce((map, row) => map.set(row.intake_session_id, [...(map.get(row.intake_session_id) || []), row]), new Map());
    const artifacts = group(artifactResult.data);
    const suggestions = group(suggestionResult.data);
    const feedback = new Map((feedbackResult.data || []).map((row) => [row.intake_session_id, row]));
    const submitters = new Map((submitterResult.data || []).map((row) => [row.id, row]));

    return (sessions || []).map((session) => {
      const fields = suggestions.get(session.id) || [];
      const sessionFeedback = feedback.get(session.id);
      const submitter = submitters.get(session.submitter_id);
      return {
        id: session.id,
        contentType: session.content_type,
        state: session.state,
        createdAt: session.created_at,
        submittedAt: session.submitted_at,
        submitter: submitter?.full_name || submitter?.email || 'Unknown submitter',
        sources: (artifacts.get(session.id) || []).map((source) => ({ type: source.source_type, filename: source.original_filename, mimeType: source.mime_type, status: source.processing_status, warnings: Array.isArray(source.warnings) ? source.warnings : [], createdAt: source.created_at })),
        extractedFields: [...new Set(fields.map((field) => field.field_name).filter(Boolean))],
        reviewFields: [...new Set(fields.filter((field) => field.needs_review).map((field) => field.field_name).filter(Boolean))],
        reviewReasons: [...new Set(fields.map((field) => field.review_reason).filter(Boolean))],
        provider: fields.find((field) => field.provider)?.provider || null,
        parserVersion: fields.find((field) => field.parser_version)?.parser_version || null,
        feedback: sessionFeedback ? { rating: sessionFeedback.rating, issueFields: sessionFeedback.issue_fields || [], note: sessionFeedback.note, updatedAt: sessionFeedback.updated_at } : null,
      };
    });
  } catch {
    return null;
  }
}
