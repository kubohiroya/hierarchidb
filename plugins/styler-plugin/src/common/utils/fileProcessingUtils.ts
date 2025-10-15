export type SupportedFileType = 'csv' | 'tsv' | 'excel' | 'zip' | 'unknown';

export function detectFileType(file: File): SupportedFileType {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv')) return 'csv';
  if (name.endsWith('.tsv')) return 'tsv';
  if (name.endsWith('.xlsx') || file.type.includes('excel')) return 'excel';
  if (name.endsWith('.zip') || file.type.includes('zip')) return 'zip';
  return 'unknown';
}

