import type { NodeId } from '@hierarchidb/core-types';
import type {
  MaterializedStagedFolderExportRows,
  MaterializeStagedFolderExportRowsInput,
  StagedFolderExportRow,
} from '@hierarchidb/staged-folder-action/export-file-host';
import type { LocationPointProperties } from '~/common/entities/LocationPoint';

export const LOCATION_EXPORT_COLUMNS = [
  'pointId',
  'name',
  'type',
  'latitude',
  'longitude',
  'admin0Code',
  'admin0',
  'admin1',
  'admin2',
  'renderRank',
  'importance',
  'iconKey',
  'labelClass',
  'minZoom',
] as const;

export type LocationExportAdapterPorts = {
  resolveSourceNodeId(stagingRootNodeId: NodeId, sourcePath: string): Promise<NodeId>;
  resolveEffectiveData(nodeId: NodeId): Promise<Record<string, unknown>>;
  listLocationPoints(nodeId: NodeId): Promise<readonly LocationPointProperties[]>;
};

export function createLocationExportRowsMaterializer(
  ports: LocationExportAdapterPorts
): (input: MaterializeStagedFolderExportRowsInput) => Promise<MaterializedStagedFolderExportRows> {
  return async (input) => {
    if (input.action.entityType !== 'location') {
      throw new Error(
        `[location export] unsupported entityType for location adapter: ${input.action.entityType}`
      );
    }
    const sourceNodeId = await ports.resolveSourceNodeId(
      input.stagingRootNodeId,
      input.action.source.path
    );
    assertEffectiveDataRecord(await ports.resolveEffectiveData(sourceNodeId), sourceNodeId);
    const points = await ports.listLocationPoints(sourceNodeId);
    return {
      columns: LOCATION_EXPORT_COLUMNS,
      rows: [...points].sort(compareLocationPoints).map(toLocationExportRow),
    };
  };
}

const toLocationExportRow = (point: LocationPointProperties): StagedFolderExportRow => ({
  pointId: requireNonEmptyString(point.pointId, 'pointId'),
  name: requireNonEmptyString(point.name, 'name'),
  type: requireNonEmptyString(point.type, 'type'),
  latitude: requireFiniteNumber(point.latitude, 'latitude'),
  longitude: requireFiniteNumber(point.longitude, 'longitude'),
  admin0Code: optionalString(point.admin0Code, 'admin0Code'),
  admin0: optionalString(point.admin0, 'admin0'),
  admin1: optionalString(point.admin1, 'admin1'),
  admin2: optionalString(point.admin2, 'admin2'),
  renderRank: requireFiniteNumber(point.renderRank, 'renderRank'),
  importance: requireFiniteNumber(point.importance, 'importance'),
  iconKey: requireNonEmptyString(point.iconKey, 'iconKey'),
  labelClass: requireNonEmptyString(point.labelClass, 'labelClass'),
  minZoom: requireFiniteNumber(point.minZoom, 'minZoom'),
});

const compareLocationPoints = (
  left: LocationPointProperties,
  right: LocationPointProperties
): number =>
  [left.admin0Code ?? '', left.type, left.name, left.pointId]
    .join('\0')
    .localeCompare([right.admin0Code ?? '', right.type, right.name, right.pointId].join('\0'));

const assertEffectiveDataRecord = (value: unknown, nodeId: NodeId): void => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(
      `[location export] effective staged data for node ${String(nodeId)} must be an object`
    );
  }
};

const requireNonEmptyString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`[location export] ${field} must be a non-empty string`);
  }
  return value;
};

const optionalString = (value: unknown, field: string): string | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new Error(`[location export] ${field} must be a string when present`);
  }
  return value;
};

const requireFiniteNumber = (value: unknown, field: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`[location export] ${field} must be a finite number`);
  }
  return value;
};
