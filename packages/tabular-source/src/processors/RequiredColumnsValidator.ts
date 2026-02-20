import type { TabularProcessor } from '~/processor';

export function createRequiredColumnsValidator(id: string, required: string[]): TabularProcessor {
  const set = new Set(required);
  return {
    id,
    validateRow(row: Record<string, any>) {
      const missing: string[] = [];
      for (const key of set) {
        const value = row[key];
        if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
          missing.push(key);
        }
      }
      return missing.map((key) => `Missing required column: ${key}`);
    },
  };
}
