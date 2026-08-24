export type StagedFolderActionManifestErrorCode =
  | 'STAGED_FOLDER_ACTION_MANIFEST_PARSE_ERROR'
  | 'STAGED_FOLDER_ACTION_MANIFEST_ROOT_INVALID'
  | 'STAGED_FOLDER_ACTION_MANIFEST_REQUIRED_FIELD_MISSING'
  | 'STAGED_FOLDER_ACTION_MANIFEST_UNSUPPORTED_VERSION'
  | 'STAGED_FOLDER_ACTION_MANIFEST_INVALID_STAGING_MODE'
  | 'STAGED_FOLDER_ACTION_MANIFEST_INVALID_CLEANUP'
  | 'STAGED_FOLDER_ACTION_MANIFEST_INVALID_PATH'
  | 'STAGED_FOLDER_ACTION_MANIFEST_INVALID_OVERLAY'
  | 'STAGED_FOLDER_ACTION_MANIFEST_INVALID_ACTION'
  | 'STAGED_FOLDER_ACTION_MANIFEST_INVALID_BBOX'
  | 'STAGED_FOLDER_ACTION_MANIFEST_INVALID_SIZE'
  | 'STAGED_FOLDER_ACTION_MANIFEST_INVALID_CLI_ARGUMENTS';

export type StagedFolderActionManifestErrorDetails = {
  code: StagedFolderActionManifestErrorCode;
  path: string;
  reason: string;
};

export class StagedFolderActionManifestError extends Error {
  readonly code: StagedFolderActionManifestErrorCode;
  readonly details: StagedFolderActionManifestErrorDetails;

  constructor(details: StagedFolderActionManifestErrorDetails) {
    super(`${details.code} at ${details.path}: ${details.reason}`);
    this.name = 'StagedFolderActionManifestError';
    this.code = details.code;
    this.details = details;
  }
}
