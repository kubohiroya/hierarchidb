import { registerParser } from '@hierarchidb/tabular/registry';
import { xlsxParser } from './xlsxParser';

export function installTabularXlsx(): void {
  registerParser(xlsxParser);
}

// Optional capability helpers for UI
let installed = false;
export function isTabularXlsxInstalled(): boolean {
  return installed;
}
export function markTabularXlsxInstalled(): void {
  installed = true;
}
export const featureDefinition = {
  manifest: { name: '@hierarchidb/tabular-xlsx', depends: ['@hierarchidb/tabular'], provides: ['tabular-xlsx'] },
  init() { installTabularXlsx(); markTabularXlsxInstalled(); },
};
