import { createServerSupabaseClient, isDemoMode } from './supabaseServerClient';
import {
  samplePendingOpportunities,
  samplePendingEvents,
  samplePendingAnnouncements,
  sampleOpportunities,
  sampleEvents,
  sampleAnnouncements,
} from './sampleData';
import { REVIEW_WINDOWS, countSubmissionRecords, cutoffIso } from './reviewMetrics';

// Admin-only reads/writes for the review queue. Always runs server-side
// with the signed-in admin's own session -- there's no service-role
// bypass; the database's is_admin() RLS policies (see schema.sql) are
// what actually gate these updates from succeeding.

export async function getPendingQueue() {
  if (isDemoMode) {
    const withEvidence = (item, index) => ({
      ...item,
      intake_evidence: item.submitted_by ? {
        relationship_to_source: index % 2 ? 'pvamu_department_referral' : 'original_contact',
        artifacts: [{ id: `demo-artifact-${item.id}`, source_type: item.flyer_url ? 'flyer' : 'source_link', original_filename: item.flyer_url ? 'submitted-source.pdf' : 'Source link supplied', processing_status: 'processed', signed_url: item.flyer_url || item.source_url || item.link || null }],
        suggestions: [{ id: `demo-suggestion-${item.id}`, field_name: 'title', suggested_value: item.title, provider: 'local', parser_version: 'local-rules-v1', confidence: index % 3 ? 92 : 76, needs_review: index % 3 === 0, review_reason: index % 3 === 0 ? 'Confirm document-layout inference.' : null }],
      } : null,
    });
    return {
      opportunities: [
        ...samplePendingOpportunities,
        ...sampleOpportunities.filter((item) => item.submitted_by).map((item) => ({ ...item, status: 'pending', created_at: item.created_at || '2026-08-28' })),
      ].map(withEvidence),
      events: [
        ...samplePendingEvents,
        ...sampleEvents.filter((item) => item.submitted_by).map((item) => ({ ...item, status: 'pending', created_at: item.created_at || '2026-08-28' })),
      ].map(withEvidence),
      announcements: samplePendingAnnouncements.map(withEvidence),
    };
  }
  const supabase = await createServerSupabaseClient();
  const [opportunities, events, announcements] = await Promise.all([
    supabase.from('opportunities').select('*, submitted_by:user_roles!opportunities_submitted_by_fkey(full_name, email, org)').in('status', ['pending', 'resubmitted']).order('created_at', { ascending: true }),
    supabase.from('events').select('*, submitted_by:user_roles!events_submitted_by_fkey(full_name, email, org)').in('status', ['pending', 'resubmitted']).order('created_at', { ascending: true }),
    supabase.from('announcements').select('*, submitted_by:user_roles!announcements_submitted_by_fkey(full_name, email, org)').in('status', ['pending', 'resubmitted']).order('created_at', { ascending: true }),
  ]);

  const failed = [opportunities, events, announcements].find((result) => result.error);
  if (failed) throw new Error('The review queue could not be loaded. No sample records were substituted.');

  const queue = {
    opportunities: opportunities.data || [],
    events: events.data || [],
    announcements: announcements.data || [],
  };
  const sessionIds = [...new Set(Object.values(queue).flat().map((item) => item.intake_session_id).filter(Boolean))];
  if (!sessionIds.length) return queue;

  const [sessions, artifacts, suggestions] = await Promise.all([
    supabase.from('intake_sessions').select('id, relationship_to_source, referral_name, referral_title, referral_organization, referral_may_display, state, submitted_at').in('id', sessionIds),
    supabase.from('source_artifacts').select('id, intake_session_id, source_type, original_filename, storage_path, source_text, mime_type, byte_size, page_count, processing_status, warnings, created_at').in('intake_session_id', sessionIds),
    supabase.from('field_suggestions').select('id, intake_session_id, source_artifact_id, field_name, suggested_value, provider, parser_version, confidence, needs_review, review_reason, contributor_value, created_at').in('intake_session_id', sessionIds),
  ]);
  if (sessions.error || artifacts.error || suggestions.error) {
    throw new Error('Private intake evidence could not be loaded for the review queue.');
  }

  const signedArtifacts = await Promise.all((artifacts.data || []).map(async (artifact) => {
    if (!artifact.storage_path) return { ...artifact, signed_url: null };
    const { data } = await supabase.storage.from('intake-sources').createSignedUrl(artifact.storage_path, 600);
    return { ...artifact, signed_url: data?.signedUrl || null };
  }));
  const sessionMap = new Map((sessions.data || []).map((session) => [session.id, {
    ...session,
    artifacts: signedArtifacts.filter((artifact) => artifact.intake_session_id === session.id),
    suggestions: (suggestions.data || []).filter((suggestion) => suggestion.intake_session_id === session.id),
  }]));
  return Object.fromEntries(Object.entries(queue).map(([key, items]) => [key, items.map((item) => ({ ...item, intake_evidence: sessionMap.get(item.intake_session_id) || null }))]));
}

export async function getSubmissionMetrics(now = new Date()) {
  if (isDemoMode) {
    const records = {
      opportunities: [...sampleOpportunities, ...samplePendingOpportunities],
      events: [...sampleEvents, ...samplePendingEvents],
      announcements: [...sampleAnnouncements, ...samplePendingAnnouncements],
    };
    return Object.fromEntries(Object.entries(REVIEW_WINDOWS).map(([window, days]) => {
      const counts = Object.fromEntries(Object.entries(records).map(([type, items]) => [type, countSubmissionRecords(items, days, now)]));
      return [window, { ...counts, total: Object.values(counts).reduce((sum, count) => sum + count, 0), partial: false }];
    }));
  }

  const supabase = await createServerSupabaseClient();
  const tableNames = ['opportunities', 'events', 'announcements'];
  const windows = {};
  for (const [window, days] of Object.entries(REVIEW_WINDOWS)) {
    const results = await Promise.all(tableNames.map((table) => {
      let query = supabase.from(table).select('id', { count: 'exact', head: true });
      if (days != null) query = query.gte('created_at', cutoffIso(days, now));
      return query;
    }));
    const counts = {};
    results.forEach((result, index) => {
      counts[tableNames[index]] = result.error ? null : result.count;
    });
    const available = Object.values(counts).filter(Number.isFinite);
    windows[window] = {
      ...counts,
      total: available.length === tableNames.length ? available.reduce((sum, count) => sum + count, 0) : null,
      partial: available.length !== tableNames.length,
    };
  }
  return windows;
}

export async function getPublishedMetrics(now = new Date()) {
  const records = isDemoMode ? { opportunities: sampleOpportunities, events: sampleEvents, announcements: sampleAnnouncements } : null;
  if (records) return Object.fromEntries(Object.entries(REVIEW_WINDOWS).map(([window,days]) => [window,Object.fromEntries(Object.entries(records).map(([type,items]) => [type,countSubmissionRecords(items,days,now)]))]));
  const supabase = await createServerSupabaseClient();
  const result = {};
  for (const [window,days] of Object.entries(REVIEW_WINDOWS)) {
    const entries = await Promise.all(['opportunities','events','announcements'].map(async table => { let query=supabase.from(table).select('id',{count:'exact',head:true}).eq('status','published'); if(days!=null)query=query.gte('created_at',cutoffIso(days,now)); const {count,error}=await query; return [table,error?null:count]; }));
    result[window]=Object.fromEntries(entries);
  }
  return result;
}

const TABLES = { opportunity: 'opportunities', event: 'events', announcement: 'announcements' };

export async function setItemStatus(type, id, status, reason = null) {
  if (isDemoMode) return { ok: true, demo: true };
  if (!TABLES[type]) return { ok: false, error: 'Unknown content type' };
  if (!['published', 'rejected'].includes(status)) return { ok: false, error: 'Unknown review decision' };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('review_content', {
    p_content_type: type,
    p_content_id: id,
    p_decision: status,
    p_reason: reason,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
}

export async function saveReviewEvidence(type, id, evidence = {}, decision = 'in_review') {
  if (isDemoMode) return { ok: true, demo: true };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('record_review_evidence', {
    p_content_type: type, p_content_id: id,
    p_official_source_opened: Boolean(evidence.official_source_opened),
    p_primary_link_checked: Boolean(evidence.primary_link_checked),
    p_essential_facts_verified: Boolean(evidence.essential_facts_verified),
    p_contact_organization_verified: Boolean(evidence.contact_organization_verified),
    p_safe_content_confirmed: Boolean(evidence.safe_content_confirmed),
    p_reviewer_notes: evidence.reviewer_notes || null, p_decision: decision,
  });
  return error ? { ok: false, error: error.message } : { ok: true, data };
}

export async function requestReviewCorrection(type, id, reason) {
  if (isDemoMode) return { ok: true, demo: true };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('request_review_correction', { p_content_type: type, p_content_id: id, p_reason: reason });
  return error ? { ok: false, error: error.message } : { ok: true, data };
}
