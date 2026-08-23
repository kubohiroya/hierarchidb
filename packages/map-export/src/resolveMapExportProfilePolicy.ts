import { MapExportProfilePolicyError } from './MapExportProfilePolicyError.js';
import type {
  MapExportCachePolicy,
  MapExportProfilePolicy,
  ResolveMapExportProfilePolicyInput,
} from './MapExportProfilePolicyTypes.js';

const fail = (
  code: ConstructorParameters<typeof MapExportProfilePolicyError>[0]['code'],
  path: string,
  reason: string
): never => {
  throw new MapExportProfilePolicyError({ code, path, reason });
};

const requireProfilePath = (value: string | undefined, path: string): string => {
  if (value === undefined || value.length === 0 || value !== value.trim()) {
    fail('MAP_EXPORT_PROFILE_INVALID_PATH', path, 'expected a non-empty trimmed path');
  }
  const profilePath = value as string;
  if (profilePath.includes('\0')) {
    fail('MAP_EXPORT_PROFILE_INVALID_PATH', path, 'path must not contain NUL bytes');
  }
  return profilePath;
};

const resolveCachePolicy = (input: ResolveMapExportProfilePolicyInput): MapExportCachePolicy => {
  const enabled = [
    input.fresh === true ? 'fresh' : null,
    input.offline === true ? 'offline' : null,
    input.refresh === true ? 'refresh' : null,
  ].filter((value): value is MapExportCachePolicy => value !== null);
  if (enabled.length > 1) {
    fail(
      'MAP_EXPORT_CACHE_POLICY_CONFLICTING_OPTIONS',
      '$.cachePolicy',
      `expected at most one cache policy override, received ${enabled.join(', ')}`
    );
  }
  return enabled[0] ?? 'reuse';
};

export const resolveMapExportProfilePolicy = (
  input: ResolveMapExportProfilePolicyInput
): MapExportProfilePolicy => {
  const cachePolicy = resolveCachePolicy(input);
  if (input.fresh === true && input.profileDir !== undefined) {
    fail(
      'MAP_EXPORT_PROFILE_CONFLICTING_OPTIONS',
      '$.profileDir',
      '--fresh uses a temporary profile and cannot be combined with --profile'
    );
  }
  if (input.fresh === true) {
    return {
      profileMode: 'temporary-fresh',
      profileDir: null,
      cachePolicy,
    };
  }
  if (input.profileDir !== undefined) {
    return {
      profileMode: 'explicit-persistent',
      profileDir: requireProfilePath(input.profileDir, '$.profileDir'),
      cachePolicy,
    };
  }
  return {
    profileMode: 'default-persistent',
    profileDir: requireProfilePath(input.defaultProfileDir, '$.defaultProfileDir'),
    cachePolicy,
  };
};
