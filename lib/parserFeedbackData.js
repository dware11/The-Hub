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
