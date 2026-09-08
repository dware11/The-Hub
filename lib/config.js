const isProduction = process.env.NODE_ENV === 'production';

function enabled(name) {
  return process.env[name] === 'true';
}

export const appConfig = Object.freeze({
  environment: process.env.NODE_ENV || 'development',
  isProduction,
  demoMode: enabled('DEMO_MODE') || enabled('NEXT_PUBLIC_DEMO_MODE'),
  features: Object.freeze({
    graphMailIntake: enabled('ENABLE_GRAPH_MAIL_INTAKE'),
    sharePointStorage: enabled('ENABLE_SHAREPOINT_STORAGE'),
    aiAssistedParser: enabled('ENABLE_AI_ASSISTED_PARSER'),
    studentSubscriptions: enabled('ENABLE_STUDENT_SUBSCRIPTIONS'),
    deadlineAlerts: enabled('ENABLE_DEADLINE_ALERTS'),
    recruiterInvitations: enabled('ENABLE_RECRUITER_INVITATIONS'),
    partnershipWorkflow: enabled('ENABLE_PARTNERSHIP_WORKFLOW'),
    parserFeedback: process.env.NEXT_PUBLIC_ENABLE_PARSER_FEEDBACK !== 'false',
  }),
});

export function getConfigurationStatus() {
  return validateProductionConfiguration(process.env);
}

export function validateProductionConfiguration(env) {
  const missing = [];
  if (!env.NEXT_PUBLIC_SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!env.NEXT_PUBLIC_SUPABASE_ANON_KEY) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const production = env.NODE_ENV === 'production';
  const publicDemo = env.NEXT_PUBLIC_DEMO_MODE === 'true';
  const serverDemo = env.DEMO_MODE === 'true';

  return {
    valid: !production || (!publicDemo && !serverDemo && missing.length === 0),
    missing,
    demoMode: publicDemo || serverDemo,
    publicDemo,
    serverDemo,
    environment: env.NODE_ENV || 'development',
  };
}

export function assertProductionConfiguration() {
  const status = getConfigurationStatus();
  if (appConfig.isProduction && status.demoMode) {
    throw new Error('NEXT_PUBLIC_DEMO_MODE and DEMO_MODE are prohibited in production.');
  }
  if (!status.valid) {
    throw new Error(`Missing required production configuration: ${status.missing.join(', ')}`);
  }
}
