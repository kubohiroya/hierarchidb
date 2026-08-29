import type {
  MountedIdeGsmCsvSourceReference,
  MountedIdeGsmCsvSourceValidationCode,
  StylerEntity,
  StylerTablePrimitive,
  StylerTableRow,
} from '@hierarchidb/styler-store';
import { validateMountedIdeGsmCsvSourceReference } from '@hierarchidb/styler-store';

export type MountedIdeGsmCsvSourceLoadErrorCode =
  | MountedIdeGsmCsvSourceValidationCode
  | 'SOURCE_NOT_CONFIGURED'
  | 'CSV_SOURCE_MISSING'
  | 'CSV_SOURCE_MALFORMED'
  | 'CSV_SOURCE_CREDENTIALS_UNAVAILABLE';

export class MountedIdeGsmCsvSourceLoadError extends Error {
  constructor(readonly code: MountedIdeGsmCsvSourceLoadErrorCode) {
    super(code);
    this.name = 'MountedIdeGsmCsvSourceLoadError';
  }
}

export interface MountedIdeGsmCsvSourceReader {
  readMountedCsv(reference: MountedIdeGsmCsvSourceReference): Promise<string | null>;
}

export interface MountedIdeGsmCsvSourceLoadResult {
  readonly source: MountedIdeGsmCsvSourceReference;
  readonly columns: readonly string[];
  readonly rows: readonly StylerTableRow[];
}

export function getMountedIdeGsmCsvSourceReference(
  entity: Pick<StylerEntity, 'source'>
): MountedIdeGsmCsvSourceReference | null {
  const source = entity.source;
  if (source === undefined) {
    return null;
  }

  const validation = validateMountedIdeGsmCsvSourceReference(source);
  if (!validation.ok) {
    throw new MountedIdeGsmCsvSourceLoadError(validation.code);
  }
  return validation.value;
}

export async function loadMountedIdeGsmCsvSource(
  reference: unknown,
  reader: MountedIdeGsmCsvSourceReader
): Promise<MountedIdeGsmCsvSourceLoadResult> {
  const validation = validateMountedIdeGsmCsvSourceReference(reference);
  if (!validation.ok) {
    throw new MountedIdeGsmCsvSourceLoadError(validation.code);
  }

  let csvText: string | null;
  try {
    csvText = await reader.readMountedCsv(validation.value);
  } catch (error) {
    if (isCredentialUnavailableError(error)) {
      throw new MountedIdeGsmCsvSourceLoadError('CSV_SOURCE_CREDENTIALS_UNAVAILABLE');
    }
    throw new MountedIdeGsmCsvSourceLoadError('CSV_SOURCE_MISSING');
  }

  if (csvText === null) {
    throw new MountedIdeGsmCsvSourceLoadError('CSV_SOURCE_MISSING');
  }

  const parsed = parseCsv(csvText);
  return {
    source: validation.value,
    columns: parsed.columns,
    rows: parsed.rows,
  };
}

function isCredentialUnavailableError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'CREDENTIALS_UNAVAILABLE'
  );
}

function parseCsv(csvText: string): { columns: string[]; rows: StylerTableRow[] } {
  const rows = parseCsvRecords(csvText);
  const header = rows[0];
  if (!header || header.length === 0 || header.some((column) => column.length === 0)) {
    throw new MountedIdeGsmCsvSourceLoadError('CSV_SOURCE_MALFORMED');
  }

  const seen = new Set<string>();
  for (const column of header) {
    if (seen.has(column)) {
      throw new MountedIdeGsmCsvSourceLoadError('CSV_SOURCE_MALFORMED');
    }
    seen.add(column);
  }

  const dataRows = rows.slice(1).filter((row) => row.some((value) => value.length > 0));
  const tableRows = dataRows.map((row) => {
    if (row.length !== header.length) {
      throw new MountedIdeGsmCsvSourceLoadError('CSV_SOURCE_MALFORMED');
    }
    const tableRow: StylerTableRow = {};
    header.forEach((column, index) => {
      tableRow[column] = parseCsvPrimitive(row[index] ?? '');
    });
    return tableRow;
  });

  return {
    columns: header,
    rows: tableRows,
  };
}

function parseCsvRecords(csvText: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    if (char === undefined) {
      break;
    }

    if (quoted) {
      if (char === '"') {
        const next = csvText[index + 1];
        if (next === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      if (field.length > 0) {
        throw new MountedIdeGsmCsvSourceLoadError('CSV_SOURCE_MALFORMED');
      }
      quoted = true;
      continue;
    }

    if (char === ',') {
      record.push(field);
      field = '';
      continue;
    }

    if (char === '\n') {
      record.push(field);
      records.push(record);
      record = [];
      field = '';
      continue;
    }

    if (char === '\r') {
      continue;
    }

    field += char;
  }

  if (quoted) {
    throw new MountedIdeGsmCsvSourceLoadError('CSV_SOURCE_MALFORMED');
  }

  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  if (records.length === 0) {
    throw new MountedIdeGsmCsvSourceLoadError('CSV_SOURCE_MALFORMED');
  }

  return records;
}

function parseCsvPrimitive(value: string): StylerTablePrimitive {
  if (value.length === 0) {
    return null;
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric) && value.trim() === value && value.trim().length > 0) {
    return numeric;
  }
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return value;
}
