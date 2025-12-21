import { readRuntimeEnvFlag } from '@hierarchidb/util';

export const SHAPE_PREVIEW_METADATA_FLAG = 'HDB_SHAPE_PREVIEW_METADATA';

export const isShapePreviewMetadataEnabled = (): boolean =>
  readRuntimeEnvFlag(SHAPE_PREVIEW_METADATA_FLAG, true);
