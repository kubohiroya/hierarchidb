export type MapExportProfilePolicyErrorCode =
  | 'MAP_EXPORT_PROFILE_INVALID_PATH'
  | 'MAP_EXPORT_PROFILE_CONFLICTING_OPTIONS'
  | 'MAP_EXPORT_CACHE_POLICY_CONFLICTING_OPTIONS';

export type MapExportProfilePolicyErrorDetails = {
  code: MapExportProfilePolicyErrorCode;
  path: string;
  reason: string;
};

export class MapExportProfilePolicyError extends Error {
  readonly code: MapExportProfilePolicyErrorCode;
  readonly details: MapExportProfilePolicyErrorDetails;

  constructor(details: MapExportProfilePolicyErrorDetails) {
    super(`${details.code} at ${details.path}: ${details.reason}`);
    this.name = 'MapExportProfilePolicyError';
    this.code = details.code;
    this.details = details;
  }
}
