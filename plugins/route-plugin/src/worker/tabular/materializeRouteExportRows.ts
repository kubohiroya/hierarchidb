import type { NodeId } from '@hierarchidb/core-types';
import type { RouteFeature } from '@hierarchidb/route-api';
import type {
  MaterializedStagedFolderExportRows,
  MaterializeStagedFolderExportRowsInput,
  StagedFolderExportRow,
} from '@hierarchidb/staged-folder-action/export-file-host';

export const ROUTE_EXPORT_COLUMNS = [
  'featureId',
  'name',
  'routeMode',
  'startLocationId',
  'endLocationId',
  'startLatitude',
  'startLongitude',
  'endLatitude',
  'endLongitude',
  'distance',
  'speed',
  'oneway',
] as const;

export type RouteExportAdapterPorts = {
  resolveSourceNodeId(stagingRootNodeId: NodeId, sourcePath: string): Promise<NodeId>;
  resolveEffectiveData(nodeId: NodeId): Promise<Record<string, unknown>>;
  listRouteFeatures(nodeId: NodeId): Promise<readonly RouteFeature[]>;
};

export function createRouteExportRowsMaterializer(
  ports: RouteExportAdapterPorts
): (input: MaterializeStagedFolderExportRowsInput) => Promise<MaterializedStagedFolderExportRows> {
  return async (input) => {
    if (input.action.entityType !== 'route') {
      throw new Error(
        `[route export] unsupported entityType for route adapter: ${input.action.entityType}`
      );
    }
    const sourceNodeId = await ports.resolveSourceNodeId(
      input.stagingRootNodeId,
      input.action.source.path
    );
    assertEffectiveDataRecord(await ports.resolveEffectiveData(sourceNodeId), sourceNodeId);
    const features = await ports.listRouteFeatures(sourceNodeId);
    return {
      columns: ROUTE_EXPORT_COLUMNS,
      rows: [...features].sort(compareRouteFeatures).map(toRouteExportRow),
    };
  };
}

const toRouteExportRow = (feature: RouteFeature): StagedFolderExportRow => ({
  featureId: requireNonEmptyString(feature.featureId, 'featureId'),
  name: requireNonEmptyString(feature.name, 'name'),
  routeMode: requireNonEmptyString(feature.routeMode, 'routeMode'),
  startLocationId: optionalString(feature.startLocationId, 'startLocationId'),
  endLocationId: optionalString(feature.endLocationId, 'endLocationId'),
  startLatitude: requireFiniteNumber(feature.startPoint?.latitude, 'startPoint.latitude'),
  startLongitude: requireFiniteNumber(feature.startPoint?.longitude, 'startPoint.longitude'),
  endLatitude: requireFiniteNumber(feature.endPoint?.latitude, 'endPoint.latitude'),
  endLongitude: requireFiniteNumber(feature.endPoint?.longitude, 'endPoint.longitude'),
  distance: optionalFiniteNumber(feature.distance, 'distance'),
  speed: optionalFiniteNumber(feature.speed, 'speed'),
  oneway: optionalBoolean(feature.metadata?.oneway, 'metadata.oneway'),
});

const compareRouteFeatures = (left: RouteFeature, right: RouteFeature): number =>
  [left.routeMode, left.startLocationId ?? '', left.endLocationId ?? '', left.featureId, left.name]
    .join('\0')
    .localeCompare(
      [
        right.routeMode,
        right.startLocationId ?? '',
        right.endLocationId ?? '',
        right.featureId,
        right.name,
      ].join('\0')
    );

const assertEffectiveDataRecord = (value: unknown, nodeId: NodeId): void => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(
      `[route export] effective staged data for node ${String(nodeId)} must be an object`
    );
  }
};

const requireNonEmptyString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`[route export] ${field} must be a non-empty string`);
  }
  return value;
};

const optionalString = (value: unknown, field: string): string | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new Error(`[route export] ${field} must be a string when present`);
  }
  return value;
};

const requireFiniteNumber = (value: unknown, field: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`[route export] ${field} must be a finite number`);
  }
  return value;
};

const optionalFiniteNumber = (value: unknown, field: string): number | undefined => {
  if (value === undefined) return undefined;
  return requireFiniteNumber(value, field);
};

const optionalBoolean = (value: unknown, field: string): boolean | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') {
    throw new Error(`[route export] ${field} must be a boolean when present`);
  }
  return value;
};
