import { dirname, isAbsolute, resolve } from 'node:path';
import type { NodeId } from '@hierarchidb/core-types';
import type {
  StagedFolderActionConfig,
  StagedFolderExportCsvAction,
  StagedFolderExportXlsxAction,
} from './StagedFolderActionManifestTypes.js';
import type {
  StagedFolderActionResult,
  StagedFolderExportCsvActionResult,
  StagedFolderExportXlsxActionResult,
} from './StagedFolderActionProgressTypes.js';

export type StagedFolderExportFileAction =
  | StagedFolderExportCsvAction
  | StagedFolderExportXlsxAction;

export type StagedFolderExportCellValue = string | number | boolean | null | undefined;

export type StagedFolderExportRow = Record<string, StagedFolderExportCellValue>;

export type MaterializeStagedFolderExportRowsInput = {
  action: StagedFolderExportFileAction;
  actionIndex: number;
  config: StagedFolderActionConfig;
  stagingRootNodeId: NodeId;
  runId: NodeId;
};

export type MaterializedStagedFolderExportRows = {
  columns: readonly string[];
  rows: readonly StagedFolderExportRow[];
};

export type WriteStagedFolderExportXlsxInput = {
  path: string;
  sheetName: string;
  columns: readonly string[];
  rows: readonly StagedFolderExportRow[];
};

export type CreateExportFileActionRunnerInput = {
  outputBasePath: string;
  materializeRows(
    input: MaterializeStagedFolderExportRowsInput
  ): Promise<MaterializedStagedFolderExportRows>;
  writeFile(path: string, content: string): Promise<void>;
  ensureDirectory?(path: string): Promise<void>;
  writeXlsx?(input: WriteStagedFolderExportXlsxInput): Promise<void>;
};

export type ExportFileActionRunnerInput = MaterializeStagedFolderExportRowsInput;

export type ExportFileActionRunner = (
  input: ExportFileActionRunnerInput
) => Promise<StagedFolderActionResult>;

export function createExportFileActionRunner({
  outputBasePath,
  materializeRows,
  writeFile,
  ensureDirectory,
  writeXlsx,
}: CreateExportFileActionRunnerInput): ExportFileActionRunner {
  assertAbsolutePath(outputBasePath, 'outputBasePath');
  if (typeof materializeRows !== 'function') {
    throw new Error('materializeRows must be a function');
  }
  if (typeof writeFile !== 'function') {
    throw new Error('writeFile must be a function');
  }
  if (ensureDirectory !== undefined && typeof ensureDirectory !== 'function') {
    throw new Error('ensureDirectory must be a function');
  }
  if (writeXlsx !== undefined && typeof writeXlsx !== 'function') {
    throw new Error('writeXlsx must be a function');
  }

  return async (input) => {
    const outputPath = resolveExportOutputPath({
      outputPath: input.action.output.path,
      outputBasePath,
    });
    const materializedRows = await materializeRows(input);
    const rows = normalizeRows(materializedRows.rows);
    const columns = resolveColumns(input.action.columns, materializedRows.columns);
    await ensureDirectory?.(dirname(outputPath));
    if (input.action.type === 'export-csv') {
      await writeFile(outputPath, createExportCsvText({ columns, rows }));
      return {
        type: 'export-csv',
        status: 'completed',
        outputPath,
        entityType: input.action.entityType,
        rowCount: rows.length,
      } satisfies StagedFolderExportCsvActionResult;
    }
    if (writeXlsx === undefined) {
      throw new Error('export-xlsx writer is not configured');
    }
    const sheetName = resolveSheetName(input.action);
    await writeXlsx({
      path: outputPath,
      sheetName,
      columns,
      rows,
    });
    return {
      type: 'export-xlsx',
      status: 'completed',
      outputPath,
      entityType: input.action.entityType,
      rowCount: rows.length,
      sheetName,
    } satisfies StagedFolderExportXlsxActionResult;
  };
}

export function createExportCsvText({
  columns,
  rows,
}: {
  columns: readonly string[];
  rows: readonly StagedFolderExportRow[];
}): string {
  const normalizedColumns = normalizeColumns(columns, 'columns');
  const normalizedRows = normalizeRows(rows);
  return [
    normalizedColumns.map(escapeCsvCell).join(','),
    ...normalizedRows.map((row) =>
      normalizedColumns.map((column) => escapeCsvCell(row[column])).join(',')
    ),
  ].join('\n');
}

export function resolveExportOutputPath({
  outputPath,
  outputBasePath,
}: {
  outputPath: string;
  outputBasePath: string;
}): string {
  assertNonEmptyTrimmedString(outputPath, 'outputPath');
  assertAbsolutePath(outputBasePath, 'outputBasePath');
  if (isAbsolute(outputPath)) {
    throw new Error('outputPath must be relative to outputBasePath');
  }
  if (
    outputPath.includes('\0') ||
    outputPath
      .split('/')
      .some((segment) => segment.length === 0 || segment === '.' || segment === '..')
  ) {
    throw new Error(
      'outputPath must not contain empty, current-directory, or parent-directory segments'
    );
  }
  return resolve(outputBasePath, outputPath);
}

export function resolveExportXlsxSheetName(action: StagedFolderExportXlsxAction): string {
  return resolveSheetName(action);
}

const resolveSheetName = (action: StagedFolderExportXlsxAction): string => {
  const sheetName = action.output.sheetName ?? action.entityType;
  assertSheetName(sheetName, 'sheetName');
  return sheetName;
};

const resolveColumns = (
  configuredColumns: readonly string[] | undefined,
  materializedColumns: readonly string[]
): string[] => {
  const canonicalColumns = normalizeColumns(materializedColumns, 'materialized.columns');
  if (configuredColumns === undefined) {
    return canonicalColumns;
  }
  const selectedColumns = normalizeColumns(configuredColumns, 'action.columns');
  const unknownColumns = selectedColumns.filter((column) => !canonicalColumns.includes(column));
  if (unknownColumns.length > 0) {
    throw new Error(`action.columns contains unsupported columns: ${unknownColumns.join(', ')}`);
  }
  return selectedColumns;
};

const normalizeRows = (rows: readonly StagedFolderExportRow[]): StagedFolderExportRow[] => {
  if (!Array.isArray(rows)) {
    throw new Error('export rows must be an array');
  }
  return rows.map((row, rowIndex) => {
    if (row === null || typeof row !== 'object' || Array.isArray(row)) {
      throw new Error(`export rows[${rowIndex}] must be an object`);
    }
    const normalizedRow: StagedFolderExportRow = {};
    for (const [column, value] of Object.entries(row)) {
      assertNonEmptyTrimmedString(column, `export rows[${rowIndex}] column`);
      assertCellValue(value, `export rows[${rowIndex}].${column}`);
      normalizedRow[column] = value;
    }
    return normalizedRow;
  });
};

const normalizeColumns = (columns: readonly string[], field: string): string[] => {
  if (!Array.isArray(columns)) {
    throw new Error(`${field} must be an array`);
  }
  if (columns.length === 0) {
    throw new Error(`${field} must contain at least one column`);
  }
  const normalized = columns.map((column, index) => {
    assertNonEmptyTrimmedString(column, `${field}[${index}]`);
    return column;
  });
  if (new Set(normalized).size !== normalized.length) {
    throw new Error(`${field} must not contain duplicate columns`);
  }
  return normalized;
};

const escapeCsvCell = (value: StagedFolderExportCellValue): string => {
  if (value === null || value === undefined) {
    return '';
  }
  const text = String(value);
  if (text.includes('"') || text.includes(',') || text.includes('\n') || text.includes('\r')) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
};

function assertCellValue(
  value: unknown,
  field: string
): asserts value is StagedFolderExportCellValue {
  if (value === null || value === undefined) return;
  if (typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  throw new Error(`${field} must be a string, finite number, boolean, null, or undefined`);
}

const assertAbsolutePath = (value: string, field: string): void => {
  assertNonEmptyTrimmedString(value, field);
  if (!isAbsolute(value)) {
    throw new Error(`${field} must be an absolute path`);
  }
};

const assertNonEmptyTrimmedString = (value: string, field: string): void => {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) {
    throw new Error(`${field} must be a non-empty trimmed string`);
  }
};

const assertSheetName = (value: string, field: string): void => {
  assertNonEmptyTrimmedString(value, field);
  if (value.length > 31 || /[:\\/?*[\]]/.test(value)) {
    throw new Error(`${field} must be a valid Excel worksheet name`);
  }
};
