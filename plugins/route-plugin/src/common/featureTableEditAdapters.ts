import { ROUTE_MODES, type RouteMode } from '@hierarchidb/route-api';
import type { FeatureCellDependencyStatus, FeatureTableEditableColumn } from '@hierarchidb/ui-map';

export type RouteFeatureTableEditRow = {
  id: string | number;
  routeName?: string;
  routeMode?: string;
  startName?: string;
  endName?: string;
};

export type RouteEditableColumnId = 'routeName' | 'routeMode' | 'startName' | 'endName';

export type RouteFeatureTableAdapterFailure = {
  readonly code: 'not-editable-column' | 'invalid-string-value' | 'invalid-route-mode';
  readonly columnId: string;
  readonly message: string;
};

export type RouteFeatureTableAdapterResult<T> =
  | {
      readonly ok: true;
      readonly value: T;
    }
  | {
      readonly ok: false;
      readonly error: RouteFeatureTableAdapterFailure;
    };

export type RouteFeatureTableEditAdapter<Row extends RouteFeatureTableEditRow> = {
  readonly editableColumns: readonly FeatureTableEditableColumn<Row>[];
  readonly getEditableColumn: (
    columnId: string
  ) => RouteFeatureTableAdapterResult<FeatureTableEditableColumn<Row>>;
  readonly parseCellValue: (
    columnId: string,
    value: unknown
  ) => RouteFeatureTableAdapterResult<unknown>;
  readonly validateCellValue: (
    columnId: string,
    value: unknown
  ) => RouteFeatureTableAdapterResult<unknown>;
};

export type CreateRouteFeatureTableEditAdapterOptions<Row extends RouteFeatureTableEditRow> = {
  readonly stagingRootNodeId: string | ((row: Row) => string);
  readonly featureNodeId: string | ((row: Row) => string);
  readonly dependencyStatus?:
    | FeatureCellDependencyStatus
    | ((row: Row) => FeatureCellDependencyStatus);
};

const editableRouteFields = [
  { columnId: 'routeName', fieldPath: 'data.name', valueKind: 'string', role: 'none' },
  { columnId: 'routeMode', fieldPath: 'data.routeMode', valueKind: 'enum', role: 'artifact-input' },
  {
    columnId: 'startName',
    fieldPath: 'data.startPoint.name',
    valueKind: 'string',
    role: 'reference-source',
  },
  {
    columnId: 'endName',
    fieldPath: 'data.endPoint.name',
    valueKind: 'string',
    role: 'reference-source',
  },
] as const;

const routeModes = new Set<RouteMode>(Object.values(ROUTE_MODES));

export const createRouteFeatureTableEditAdapter = <Row extends RouteFeatureTableEditRow>(
  options: CreateRouteFeatureTableEditAdapterOptions<Row>
): RouteFeatureTableEditAdapter<Row> => {
  const dependencyStatus = options.dependencyStatus ?? 'none';
  const editableColumns = editableRouteFields.map((field) => ({
    columnId: field.columnId,
    source: {
      stagingRootNodeId: options.stagingRootNodeId,
      featureNodeId: options.featureNodeId,
      entityType: 'route' as const,
      entityId: (row: Row) => String(row.id),
      fieldPath: field.fieldPath,
    },
    valueKind: field.valueKind,
    dependencyRole: field.role,
    dependencyStatus,
    parse: `route-preview:${field.columnId}:${field.valueKind}`,
    validate: `route-preview:${field.columnId}:${field.valueKind}`,
  }));
  const editableColumnsById: ReadonlyMap<string, FeatureTableEditableColumn<Row>> = new Map(
    editableColumns.map((column) => [column.columnId, column])
  );
  return {
    editableColumns,
    getEditableColumn: (columnId) => {
      const column = editableColumnsById.get(columnId);
      return column === undefined
        ? createFailure('not-editable-column', columnId, `Column "${columnId}" is not editable.`)
        : { ok: true, value: column };
    },
    parseCellValue: parseRouteCellValue,
    validateCellValue: validateRouteCellValue,
  };
};

const parseRouteCellValue = (
  columnId: string,
  value: unknown
): RouteFeatureTableAdapterResult<unknown> => {
  const field = findRouteEditableField(columnId);
  if (field === undefined) {
    return createFailure('not-editable-column', columnId, `Column "${columnId}" is not editable.`);
  }
  if (field.columnId === 'routeMode') {
    return typeof value === 'string' && routeModes.has(value as RouteMode)
      ? { ok: true, value }
      : createFailure('invalid-route-mode', columnId, 'Route mode is not supported.');
  }
  if (typeof value !== 'string') {
    return createFailure(
      'invalid-string-value',
      columnId,
      'Route editable values must be strings.'
    );
  }
  return { ok: true, value };
};

const validateRouteCellValue = (
  columnId: string,
  value: unknown
): RouteFeatureTableAdapterResult<unknown> => {
  const field = findRouteEditableField(columnId);
  if (field === undefined) {
    return createFailure('not-editable-column', columnId, `Column "${columnId}" is not editable.`);
  }
  if (field.columnId === 'routeMode') {
    return typeof value === 'string' && routeModes.has(value as RouteMode)
      ? { ok: true, value }
      : createFailure('invalid-route-mode', columnId, 'Route mode is not supported.');
  }
  return typeof value === 'string' && value.trim() !== ''
    ? { ok: true, value }
    : createFailure('invalid-string-value', columnId, 'Route editable values must be non-empty.');
};

const findRouteEditableField = (columnId: string) =>
  editableRouteFields.find((field) => field.columnId === columnId);

const createFailure = (
  code: RouteFeatureTableAdapterFailure['code'],
  columnId: string,
  message: string
): RouteFeatureTableAdapterResult<never> => ({
  ok: false,
  error: {
    code,
    columnId,
    message,
  },
});
