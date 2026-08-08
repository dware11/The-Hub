import { getConfigurationStatus } from './config';
import { createServerSupabaseClient, isDemoMode } from './supabaseServerClient';

function result(status, responseTimeMs, details = {}) {
  return { status, responseTimeMs, ...details };
}

export async function checkApplicationHealth() {
  const checkedAt = new Date().toISOString();
  const configuration = getConfigurationStatus();

  if (isDemoMode) {
    return {
      status: 'operational',
      checkedAt,
      services: {
        application: result('operational', 0),
        configuration: result(configuration.valid ? 'operational' : 'misconfigured', 0),
        database: result('unknown', 0),
        authentication: result('unknown', 0),
        storage: result('unknown', 0),
        parser: result('operational', 0, { provider: 'local' }),
        email: result('unknown', 0),
        digest: result('unknown', 0),
        graph: result('unknown', 0, { enabled: false }),
        sharepoint: result('unknown', 0, { enabled: false }),
      },
    };
  }

  const started = Date.now();
  let database;
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from('opportunities').select('id').limit(1);
    database = result(error ? 'degraded' : 'operational', Date.now() - started);
  } catch {
    database = result('unavailable', Date.now() - started);
  }

  const requiredEmailConfigured = Boolean(
    process.env.RESEND_API_KEY &&
      process.env.DIGEST_FROM_EMAIL &&
      process.env.DIGEST_TO_EMAIL
  );
  const cronConfigured = Boolean(process.env.CRON_SECRET);

  const statuses = [
    configuration.valid ? 'operational' : 'misconfigured',
    database.status,
    requiredEmailConfigured ? 'operational' : 'misconfigured',
    cronConfigured ? 'operational' : 'misconfigured',
  ];

  const overall = statuses.includes('unavailable')
    ? 'unavailable'
    : statuses.some((status) => status !== 'operational')
      ? 'degraded'
      : 'operational';

  return {
    status: overall,
    checkedAt,
    services: {
      application: result('operational', 0),
      configuration: result(configuration.valid ? 'operational' : 'misconfigured', 0),
      database,
      authentication: result(configuration.valid ? 'operational' : 'misconfigured', 0),
      storage: result(configuration.valid ? 'operational' : 'misconfigured', 0),
      parser: result('operational', 0, { provider: 'local' }),
      email: result(requiredEmailConfigured ? 'operational' : 'misconfigured', 0),
      digest: result(cronConfigured ? 'operational' : 'misconfigured', 0),
      graph: result('unknown', 0, { enabled: false }),
      sharepoint: result('unknown', 0, { enabled: false }),
    },
  };
}

export function toPublicHealth(health) {
  return {
    status: health.status,
    checkedAt: health.checkedAt,
    services: Object.fromEntries(
      Object.entries(health.services).map(([name, service]) => [
        name,
        { status: service.status },
      ])
    ),
  };
}
