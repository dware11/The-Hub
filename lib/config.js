const isProduction = process.env.NODE_ENV === 'production';

function enabled(name) {
  return process.env[name] === 'true';
}

export const appConfig = Object.freeze({
  environment: process.env.NODE_ENV || 'development',
  isProduction,
  demoMode: enabled('DEMO_MODE'),
  features: Object.freeze({
    graphMailIntake: enabled('ENABLE_GRAPH_MAIL_INTAKE'),
    sharePointStorage: enabled('ENABLE_SHAREPOINT_STORAGE'),
    aiAssistedParser: enabled('ENABLE_AI_ASSISTED_PARSER'),
    studentSubscriptions: enabled('ENABLE_STUDENT_SUBSCRIPTIONS'),
    deadlineAlerts: enabled('ENABLE_DEADLINE_ALERTS'),
    recruiterInvitations: enabled('ENABLE_RECRUITER_INVITATIONS'),
    partnershipWorkflow: enabled('ENABLE_PARTNERSHIP_WORKFLOW'),
  }),
});

export function getConfigurationStatus() {
  const missing = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  return {
    valid: !appConfig.isProduction || (!appConfig.demoMode && missing.length === 0),
    missing,
    demoMode: appConfig.demoMode,
    environment: appConfig.environment,
  };
}

export function assertProductionConfiguration() {
  const status = getConfigurationStatus();
  if (appConfig.isProduction && appConfig.demoMode) {
    throw new Error('DEMO_MODE is prohibited in production.');
  }
  if (!status.valid) {
    throw new Error(`Missing required production configuration: ${status.missing.join(', ')}`);
  }
}
