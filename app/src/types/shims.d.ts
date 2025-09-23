// FEATURE FLAGS (ambient)
declare global {
  interface FeatureFlags {
    SUBSCRIPTION_BATCH_MS?: number | string;
    [key: string]: unknown;
  }
  // eslint-disable-next-line no-var
  var FEATURE_FLAGS: FeatureFlags | undefined;
}

export {};
