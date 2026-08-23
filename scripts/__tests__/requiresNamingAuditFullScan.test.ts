import { describe, expect, it } from 'vitest';

import { requiresNamingAuditFullScan } from '../naming-audit/requiresNamingAuditFullScan.js';

describe('requiresNamingAuditFullScan', () => {
  it.each([
    '.github/workflows/naming-audit.yml',
    'scripts/naming-audit.ts',
    'scripts/naming-audit/fileScanner.ts',
    'scripts\\naming-audit\\rules\\primaryExportRule.ts',
  ])('returns true for Naming Audit implementation path %s', (filePath) => {
    expect(requiresNamingAuditFullScan(filePath)).toBe(true);
  });

  it.each([
    'app/src/components/AppLogoIcon.tsx',
    'plugins/shape-plugin/src/ui/ShapePanel.tsx',
    '.github/workflows/naming-audit-baseline.yml',
    'scripts/__tests__/fileScanner.test.ts',
    'scripts/naming-audit-baseline.json',
    'docs/ts-file-naming-guideline.md',
  ])('returns false for ordinary path %s', (filePath) => {
    expect(requiresNamingAuditFullScan(filePath)).toBe(false);
  });
});
