import type { TabularProcessor } from '../processor.js';

export function createRequiredColumnsValidator(id: string, required: string[]): TabularProcessor {
  const set = new Set(required);
  return {
    id,
    validateRow(row) {
      const missing: string[] = [];
      for (const k of set) {
        const v = (row as any)[k];
        if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '')) missing.push(k);
      }
      return missing.map(k => `Missing required column: ${k}`);
    },
  };
}

