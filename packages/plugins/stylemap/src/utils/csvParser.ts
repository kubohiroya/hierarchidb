/**
 * @file csvParser.ts
 * @description CSV/TSV parsing utilities for StyleMap plugin
 */

/**
 * Parse CSV file content and return structured data
 */
export function parseCSVFile(
  content: string,
  delimiter: string = ','
): {
  headers: string[];
  rows: (string | number | null)[][];
} {
  const lines = content.split('\n').filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  // Parse header
  const headers = lines[0]?.split(delimiter).map((h) => h.trim().replace(/^"(.*)"$/, '$1')) || [];

  // Parse data rows
  const rows: (string | number | null)[][] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const values = line.split(delimiter).map((value) => {
      const trimmed = value.trim().replace(/^"(.*)"$/, '$1');

      // Convert to number if possible
      if (trimmed === '') return null;
      if (trimmed === 'null' || trimmed === 'NULL') return null;

      const num = Number(trimmed);
      if (!isNaN(num) && isFinite(num)) {
        return num;
      }

      return trimmed;
    });

    rows.push(values);
  }

  return { headers, rows };
}
