import { registerParser } from '@hierarchidb/tabular/registry';
import { xlsxParser } from './xlsxParser.js';

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

export class FeatureDefinition {
  static readonly manifest = { name: '@hierarchidb/tabular-xlsx', depends: ['@hierarchidb/tabular'], provides: ['tabular-xlsx'] };

  static init(): void {
    installTabularXlsx();
    markTabularXlsxInstalled();
  }
}
