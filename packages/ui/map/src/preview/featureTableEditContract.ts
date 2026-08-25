import type { DependencyEdgeStatus } from '@hierarchidb/build-api';
import type { GridCellEditCommitResult, GridCellEditParams } from '@hierarchidb/ui-grid';

export type FeatureTableEntityType = 'shape' | 'location' | 'route';

export type FeatureTableValueKind =
  | 'string'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'json'
  | 'geometry'
  | 'reference';

export type FeatureTableDependencyRole =
  | 'none'
  | 'reference-source'
  | 'reference-target'
  | 'artifact-input';

export type FeatureCellDependencyStatus = DependencyEdgeStatus | 'pending-reference' | 'none';

export type FeatureTableEditOrigin =
  | 'preview-table'
  | 'map-feature-popover'
  | 'node-detail-dialog'
  | 'cli-overlay';

type FeatureTableValueResolver<Row, Value> = Value | ((row: Row) => Value);

export type FeatureTableEditableColumn<Row> = {
  columnId: string;
  source: {
    stagingRootNodeId: FeatureTableValueResolver<Row, string>;
    featureNodeId: FeatureTableValueResolver<Row, string>;
    entityType: FeatureTableEntityType;
    entityId: FeatureTableValueResolver<Row, string>;
    fieldPath: string;
  };
  valueKind: FeatureTableValueKind;
  dependencyRole: FeatureTableDependencyRole;
  dependencyStatus: FeatureTableValueResolver<Row, FeatureCellDependencyStatus>;
  parse: 'builtin' | string;
  validate: 'builtin' | string;
};

export type FeatureCellEditRequest = {
  stagingRootNodeId: string;
  featureNodeId: string;
  entityType: FeatureTableEntityType;
  entityId: string;
  fieldPath: string;
  previousValue: unknown;
  nextValue: unknown;
  dependencyStatus: FeatureCellDependencyStatus;
  editOrigin: FeatureTableEditOrigin;
};

export type FeatureTableEditConfig<Row> = {
  editOrigin: FeatureTableEditOrigin;
  editableColumns: FeatureTableEditableColumn<Row>[];
  onCellEditRequest: (
    request: FeatureCellEditRequest
  ) => void | GridCellEditCommitResult | Promise<void | GridCellEditCommitResult>;
};

export const findFeatureTableEditableColumn = <Row>(
  editableColumns: FeatureTableEditableColumn<Row>[],
  columnId: string
): FeatureTableEditableColumn<Row> | undefined =>
  editableColumns.find((column) => column.columnId === columnId);

const resolveValue = <Row, Value>(
  resolver: FeatureTableValueResolver<Row, Value>,
  row: Row
): Value => (typeof resolver === 'function' ? (resolver as (row: Row) => Value)(row) : resolver);

export const buildFeatureCellEditRequest = <Row extends { id: string | number }>(
  params: GridCellEditParams<Row>,
  editOrigin: FeatureTableEditOrigin,
  editableColumn: FeatureTableEditableColumn<Row>
): FeatureCellEditRequest => ({
  stagingRootNodeId: resolveValue(editableColumn.source.stagingRootNodeId, params.row),
  featureNodeId: resolveValue(editableColumn.source.featureNodeId, params.row),
  entityType: editableColumn.source.entityType,
  entityId: resolveValue(editableColumn.source.entityId, params.row),
  fieldPath: editableColumn.source.fieldPath,
  previousValue: params.previousValue,
  nextValue: params.value,
  dependencyStatus: resolveValue(editableColumn.dependencyStatus, params.row),
  editOrigin,
});
