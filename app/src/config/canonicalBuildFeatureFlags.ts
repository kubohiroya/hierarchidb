type CanonicalBuildFeatureFlagEnv = {
  VITE_CANONICAL_BUILD_INPUT_ENVELOPE?: string;
  VITE_CANONICAL_BUILD_RUNTIME_ADAPTER?: string;
};

export type CanonicalBuildFeatureFlags = {
  canonicalBuildInputEnvelope: boolean;
  canonicalBuildRuntimeAdapter: boolean;
};

const readStartupFlag = (
  env: CanonicalBuildFeatureFlagEnv,
  key: keyof CanonicalBuildFeatureFlagEnv
): boolean => {
  const value = env[key];
  if (value === undefined || value === '') return false;
  if (value === '0') return false;
  if (value === '1') return true;
  throw new Error(`${String(key)} must be unset, 0, or 1`);
};

export const resolveCanonicalBuildFeatureFlags = (
  env: CanonicalBuildFeatureFlagEnv
): CanonicalBuildFeatureFlags => ({
  canonicalBuildInputEnvelope: readStartupFlag(env, 'VITE_CANONICAL_BUILD_INPUT_ENVELOPE'),
  canonicalBuildRuntimeAdapter: readStartupFlag(env, 'VITE_CANONICAL_BUILD_RUNTIME_ADAPTER'),
});

export const canonicalBuildFeatureFlags = resolveCanonicalBuildFeatureFlags(
  import.meta.env as CanonicalBuildFeatureFlagEnv
);
