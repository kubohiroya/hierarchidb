import type { NodeId } from '@hierarchidb/core-types';
import type { ShapeDataSourceName } from '@hierarchidb/shape-api';
import type { UiStorageBridge } from '@hierarchidb/worker-api';

export type ShapeDownloadTaskPayload = {
  url: string;
  countryCode: string;
  countryName?: string;
  adminLevel: number;
  dataSource?: ShapeDataSourceName;
};

export type ShapeBuildExtensions = {
  setCorsProxyBaseURL(url: string): void;
  setUiStorageBridge(bridge: UiStorageBridge): Promise<void>;
  generateDownloadTaskPayloadsFromSelection(
    nodeId: NodeId,
    dataSource: ShapeDataSourceName,
    selectedArrayByCountries: Record<string, boolean[]>
  ): Promise<ShapeDownloadTaskPayload[]>;
};

export const resolveShapeBuildExtensions = (mod: unknown): ShapeBuildExtensions => {
  if (!mod || (typeof mod !== 'object' && typeof mod !== 'function')) {
    throw new Error('[worker bootstrap] Shape worker module must be an object');
  }
  const record = mod as Record<string, unknown>;
  const candidate = record.shapeBuildExtensions;
  if (candidate === null || typeof candidate !== 'object') {
    throw new Error('[worker bootstrap] shapeBuildExtensions export must be an object');
  }
  const extensions = candidate as Record<string, unknown>;
  for (const methodName of [
    'setCorsProxyBaseURL',
    'setUiStorageBridge',
    'generateDownloadTaskPayloadsFromSelection',
  ] as const) {
    if (typeof extensions[methodName] !== 'function') {
      throw new Error(`[worker bootstrap] shapeBuildExtensions.${methodName} must be a function`);
    }
  }
  return candidate as ShapeBuildExtensions;
};
