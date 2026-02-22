/**
 * Feature Flags - 渐进发布控制
 */

export interface FeatureFlags {
  DYNAMIC_SUMMARY_ENABLED: boolean;
}

export const FEATURE_FLAGS: FeatureFlags = {
  DYNAMIC_SUMMARY_ENABLED: process.env.DYNAMIC_SUMMARY_ENABLED === 'true',
};

export function isDynamicSummaryEnabled(): boolean {
  return FEATURE_FLAGS.DYNAMIC_SUMMARY_ENABLED;
}
