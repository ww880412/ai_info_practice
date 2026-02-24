/**
 * Feature Flags - 渐进发布控制
 */

export interface FeatureFlags {
  DYNAMIC_SUMMARY_ENABLED: boolean;
}

export const FEATURE_FLAGS: FeatureFlags = {
  // Default ON for robustness. Set DYNAMIC_SUMMARY_ENABLED=false to disable.
  DYNAMIC_SUMMARY_ENABLED: process.env.DYNAMIC_SUMMARY_ENABLED !== 'false',
};

export function isDynamicSummaryEnabled(): boolean {
  return FEATURE_FLAGS.DYNAMIC_SUMMARY_ENABLED;
}
