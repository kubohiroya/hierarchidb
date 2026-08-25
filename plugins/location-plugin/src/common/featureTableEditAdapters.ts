import type { FeatureCellDependencyStatus, FeatureTableEditableColumn } from '@hierarchidb/ui-map';

export type LocationFeatureTableEditRow = {
  id: string | number;
  pointId?: string;
  name?: string;
  longitude?: number;
  latitude?: number;
  admin0Name?: string;
  admin1Name?: string;
  admin2Name?: string;
};

export type LocationEditableColumnId =
  | 'name'
  | 'longitude'
  | 'latitude'
  | 'admin0Name'
  | 'admin1Name'
  | 'admin2Name';

export type LocationFeatureTableAdapterFailure = {
  readonly code: 'not-editable-column' | 'invalid-string-value' | 'invalid-number-value';
  readonly columnId: string;
  readonly message: string;
};

export type LocationFeatureTableAdapterResult<T> =
  | {
      readonly ok: true;
      readonly value: T;
    }
  | {
      readonly ok: false;
      readonly error: LocationFeatureTableAdapterFailure;
    };

export type LocationFeatureTableEditAdapter<Row extends LocationFeatureTableEditRow> = {
  readonly editableColumns: readonly FeatureTableEditableColumn<Row>[];
  readonly getEditableColumn: (
    columnId: string
  ) => LocationFeatureTableAdapterResult<FeatureTableEditableColumn<Row>>;
  readonly parseCellValue: (
    columnId: string,
    value: unknown
  ) => LocationFeatureTableAdapterResult<unknown>;
  readonly validateCellValue: (
    columnId: string,
    value: unknown
  ) => LocationFeatureTableAdapterResult<unknown>;
};

export type CreateLocationFeatureTableEditAdapterOptions<Row extends LocationFeatureTableEditRow> =
  {
    readonly stagingRootNodeId: string | ((row: Row) => string);
    readonly featureNodeId: string | ((row: Row) => string);
    readonly dependencyStatus?:
      | FeatureCellDependencyStatus
      | ((row: Row) => FeatureCellDependencyStatus);
  };

const editableLocationFields = [
  { columnId: 'name', fieldPath: 'data.name', valueKind: 'string' },
  { columnId: 'longitude', fieldPath: 'data.longitude', valueKind: 'number' },
  { columnId: 'latitude', fieldPath: 'data.latitude', valueKind: 'number' },
  { columnId: 'admin0Name', fieldPath: 'data.admin0', valueKind: 'string' },
  { columnId: 'admin1Name', fieldPath: 'data.admin1', valueKind: 'string' },
  { columnId: 'admin2Name', fieldPath: 'data.admin2', valueKind: 'string' },
] as const;

export const createLocationFeatureTableEditAdapter = <Row extends LocationFeatureTableEditRow>(
  options: CreateLocationFeatureTableEditAdapterOptions<Row>
): LocationFeatureTableEditAdapter<Row> => {
  const dependencyStatus = options.dependencyStatus ?? 'none';
  const editableColumns = editableLocationFields.map((field) => ({
    columnId: field.columnId,
    source: {
      stagingRootNodeId: options.stagingRootNodeId,
      featureNodeId: options.featureNodeId,
      entityType: 'location' as const,
      entityId: (row: Row) => String(row.pointId ?? row.id),
      fieldPath: field.fieldPath,
    },
    valueKind: field.valueKind,
    dependencyRole:
      field.columnId === 'longitude' || field.columnId === 'latitude'
        ? ('artifact-input' as const)
        : ('none' as const),
    dependencyStatus,
    parse: `location-preview:${field.columnId}:${field.valueKind}`,
    validate: `location-preview:${field.columnId}:${field.valueKind}`,
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
    parseCellValue: parseLocationCellValue,
    validateCellValue: validateLocationCellValue,
  };
};

const parseLocationCellValue = (
  columnId: string,
  value: unknown
): LocationFeatureTableAdapterResult<unknown> => {
  const field = findLocationEditableField(columnId);
  if (field === undefined) {
    return createFailure('not-editable-column', columnId, `Column "${columnId}" is not editable.`);
  }
  if (field.valueKind === 'number') {
    if (typeof value === 'number' && Number.isFinite(value)) return { ok: true, value };
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return { ok: true, value: parsed };
    }
    return createFailure(
      'invalid-number-value',
      columnId,
      'Location numeric values must be finite.'
    );
  }
  if (typeof value !== 'string') {
    return createFailure('invalid-string-value', columnId, 'Location text values must be strings.');
  }
  return { ok: true, value };
};

const validateLocationCellValue = (
  columnId: string,
  value: unknown
): LocationFeatureTableAdapterResult<unknown> => {
  const field = findLocationEditableField(columnId);
  if (field === undefined) {
    return createFailure('not-editable-column', columnId, `Column "${columnId}" is not editable.`);
  }
  if (field.valueKind === 'number') {
    return typeof value === 'number' && Number.isFinite(value)
      ? { ok: true, value }
      : createFailure('invalid-number-value', columnId, 'Location numeric values must be finite.');
  }
  return typeof value === 'string' && value.trim() !== ''
    ? { ok: true, value }
    : createFailure('invalid-string-value', columnId, 'Location text values must be non-empty.');
};

const findLocationEditableField = (columnId: string) =>
  editableLocationFields.find((field) => field.columnId === columnId);

const createFailure = (
  code: LocationFeatureTableAdapterFailure['code'],
  columnId: string,
  message: string
): LocationFeatureTableAdapterResult<never> => ({
  ok: false,
  error: {
    code,
    columnId,
    message,
  },
});
