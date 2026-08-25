import type { FeatureCellDependencyStatus, FeatureTableEditableColumn } from '@hierarchidb/ui-map';

export type ShapeFeatureTableEditRow = {
  id: string | number;
  featureId?: string;
  countryName?: string;
  adminName?: string;
  adminCode?: string;
  dataSource?: string;
};

export type ShapeEditableColumnId = 'countryName' | 'adminName' | 'adminCode' | 'dataSource';

export type FeatureTableAdapterFailure = {
  readonly code: 'not-editable-column' | 'invalid-string-value';
  readonly columnId: string;
  readonly message: string;
};

export type FeatureTableAdapterResult<T> =
  | {
      readonly ok: true;
      readonly value: T;
    }
  | {
      readonly ok: false;
      readonly error: FeatureTableAdapterFailure;
    };

export type ShapeFeatureTableEditAdapter<Row extends ShapeFeatureTableEditRow> = {
  readonly editableColumns: readonly FeatureTableEditableColumn<Row>[];
  readonly getEditableColumn: (
    columnId: string
  ) => FeatureTableAdapterResult<FeatureTableEditableColumn<Row>>;
  readonly parseCellValue: (columnId: string, value: unknown) => FeatureTableAdapterResult<unknown>;
  readonly validateCellValue: (
    columnId: string,
    value: unknown
  ) => FeatureTableAdapterResult<unknown>;
};

export type CreateShapeFeatureTableEditAdapterOptions<Row extends ShapeFeatureTableEditRow> = {
  readonly stagingRootNodeId: string | ((row: Row) => string);
  readonly featureNodeId: string | ((row: Row) => string);
  readonly dependencyStatus?:
    | FeatureCellDependencyStatus
    | ((row: Row) => FeatureCellDependencyStatus);
};

const editableShapeFields = [
  { columnId: 'countryName', fieldPath: 'data.countryName' },
  { columnId: 'adminName', fieldPath: 'data.adminName' },
  { columnId: 'adminCode', fieldPath: 'data.adminCode' },
  { columnId: 'dataSource', fieldPath: 'data.dataSource' },
] as const;

export const createShapeFeatureTableEditAdapter = <Row extends ShapeFeatureTableEditRow>(
  options: CreateShapeFeatureTableEditAdapterOptions<Row>
): ShapeFeatureTableEditAdapter<Row> => {
  const dependencyStatus = options.dependencyStatus ?? 'none';
  const editableColumns = editableShapeFields.map((field) => ({
    columnId: field.columnId,
    source: {
      stagingRootNodeId: options.stagingRootNodeId,
      featureNodeId: options.featureNodeId,
      entityType: 'shape' as const,
      entityId: (row: Row) => String(row.featureId ?? row.id),
      fieldPath: field.fieldPath,
    },
    valueKind: 'string' as const,
    dependencyRole: 'artifact-input' as const,
    dependencyStatus,
    parse: `shape-preview:${field.columnId}:string`,
    validate: `shape-preview:${field.columnId}:required-string`,
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
    parseCellValue: parseShapeCellValue,
    validateCellValue: validateShapeCellValue,
  };
};

const parseShapeCellValue = (
  columnId: string,
  value: unknown
): FeatureTableAdapterResult<unknown> => {
  if (!isShapeEditableColumnId(columnId)) {
    return createFailure('not-editable-column', columnId, `Column "${columnId}" is not editable.`);
  }
  if (typeof value !== 'string') {
    return createFailure(
      'invalid-string-value',
      columnId,
      'Shape editable values must be strings.'
    );
  }
  return { ok: true, value };
};

const validateShapeCellValue = (
  columnId: string,
  value: unknown
): FeatureTableAdapterResult<unknown> => {
  if (!isShapeEditableColumnId(columnId)) {
    return createFailure('not-editable-column', columnId, `Column "${columnId}" is not editable.`);
  }
  if (typeof value !== 'string' || value.trim() === '') {
    return createFailure(
      'invalid-string-value',
      columnId,
      'Shape editable values must be non-empty strings.'
    );
  }
  return { ok: true, value };
};

const isShapeEditableColumnId = (columnId: string): columnId is ShapeEditableColumnId =>
  editableShapeFields.some((field) => field.columnId === columnId);

const createFailure = (
  code: FeatureTableAdapterFailure['code'],
  columnId: string,
  message: string
): FeatureTableAdapterResult<never> => ({
  ok: false,
  error: {
    code,
    columnId,
    message,
  },
});
