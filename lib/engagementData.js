import { createServerSupabaseClient, isDemoMode } from './supabaseServerClient';
import { sampleEngagementMetrics, sampleOpportunityConnections } from './sampleData';
import { rowsToEngagementCounts } from './engagement';

const WINDOWS = Object.freeze({ week: 7, month: 30, all: null });

export async function getEngagementMetrics() {
  if (isDemoMode) return sampleEngagementMetrics;

  try {
    const supabase = await createServerSupabaseClient();
    const entries = await Promise.all(Object.entries(WINDOWS).map(async ([window, days]) => {
      const { data, error } = await supabase.rpc('get_engagement_metrics', { p_days: days });
      return [window, error
        ? { available: false, counts: {} }
        : { available: true, counts: rowsToEngagementCounts(data || []) }];
    }));
    return Object.fromEntries(entries);
  } catch {
    return Object.fromEntries(Object.keys(WINDOWS).map((window) => [window, { available: false, counts: {} }]));
  }
}

export async function getOpportunityConnectionMetric() {
  if (isDemoMode) return { available: true, count: sampleOpportunityConnections, demo: true };

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc('get_public_opportunity_connections');
    if (error) return { available: false, count: null, demo: false };
    return { available: true, count: Number(data || 0), demo: false };
  } catch {
    return { available: false, count: null, demo: false };
  }
}
