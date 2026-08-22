type CsvOptions = {
  delimiter?: string;
  hasHeader?: boolean;
};

export type CsvTable = {
  headers: string[];
  rows: string[][];
};

const normalizeLineEndings = (text: string): string => text.replace(/\r\n?/g, '\n');

const splitCsvLine = (line: string, delimiter: string): string[] => {
  const cells: string[] = [];
  let buffer = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        buffer += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      cells.push(buffer);
      buffer = '';
      continue;
    }
    buffer += ch;
  }
  cells.push(buffer);
  return cells;
};

export const parseCsvTable = (text: string, options: CsvOptions = {}): CsvTable => {
  const delimiter = options.delimiter ?? ',';
  const hasHeader = options.hasHeader ?? true;
  const lines = normalizeLineEndings(text)
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

  if (lines.length === 0) return { headers: [], rows: [] };

  const rawRows = lines.map((line) => splitCsvLine(line, delimiter));
  if (!hasHeader) return { headers: [], rows: rawRows };

  const headers = rawRows[0] ?? [];
  return {
    headers,
    rows: rawRows.slice(1),
  };
};

const normalizeHeader = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, '');

export const buildHeaderIndex = (headers: string[]): Map<string, number> => {
  const map = new Map<string, number>();
  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    if (!map.has(normalized)) map.set(normalized, index);
  });
  return map;
};

export const getColumnValue = (
  row: string[],
  headerIndex: Map<string, number>,
  ...keys: string[]
): string | undefined => {
  for (const key of keys) {
    const idx = headerIndex.get(normalizeHeader(key));
    if (idx == null) continue;
    const value = row[idx];
    if (value != null && value !== '') return value;
  }
  return undefined;
};
