import { readRuntimeEnvFlag } from '@hierarchidb/util';

export type BorderGeometryStorageFlagOptions = {
  enabled?: boolean;
};

export const isShapeBorderGeometryStorageEnabled = (
  options?: BorderGeometryStorageFlagOptions
): boolean => {
  if (typeof options?.enabled === 'boolean') return options.enabled;
  return readRuntimeEnvFlag(SHAPE_BORDER_GEOMETRY_STORAGE_FLAG, false);
};

export const requireShapeBorderGeometryStorageEnabled = (
  options?: BorderGeometryStorageFlagOptions
): void => {
  if (!isShapeBorderGeometryStorageEnabled(options)) {
    throw new Error('shape-border-geometry-storage-disabled');
  }
};

export const SHAPE_BORDER_GEOMETRY_STORAGE_FLAG = 'HDB_SHAPE_BORDER_GEOMETRY_STORAGE';
