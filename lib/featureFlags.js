import { appConfig } from './config';

export function isFeatureEnabled(feature) {
  return Boolean(appConfig.features[feature]);
}

export function getPublicFeatureFlags() {
  return {
    studentSubscriptions: appConfig.features.studentSubscriptions,
    deadlineAlerts: appConfig.features.deadlineAlerts,
  };
}
