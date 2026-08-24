export type MapExportManifestErrorCode =
  | 'MAP_EXPORT_MANIFEST_PARSE_ERROR'
  | 'MAP_EXPORT_MANIFEST_ROOT_INVALID'
  | 'MAP_EXPORT_MANIFEST_REQUIRED_FIELD_MISSING'
  | 'MAP_EXPORT_MANIFEST_UNSUPPORTED_VERSION'
  | 'MAP_EXPORT_MANIFEST_INVALID_OUTPUT_PATH'
  | 'MAP_EXPORT_MANIFEST_INVALID_VIEWPORT_SIZE'
  | 'MAP_EXPORT_MANIFEST_INVALID_BBOX'
  | 'MAP_EXPORT_MANIFEST_INVALID_NODE_TYPE'
  | 'MAP_EXPORT_MANIFEST_INVALID_NODE_DATA'
  | 'MAP_EXPORT_MANIFEST_INVALID_LAYER_SELECTION';

export type MapExportManifestErrorDetails = {
  code: MapExportManifestErrorCode;
  path: string;
  reason: string;
};

export class MapExportManifestError extends Error {
  readonly code: MapExportManifestErrorCode;
  readonly details: MapExportManifestErrorDetails;

  constructor(details: MapExportManifestErrorDetails) {
    super(`${details.code} at ${details.path}: ${details.reason}`);
    this.name = 'MapExportManifestError';
    this.code = details.code;
    this.details = details;
  }
}
