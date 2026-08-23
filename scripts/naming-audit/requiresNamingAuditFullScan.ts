const FULL_SCAN_FILES: ReadonlySet<string> = new Set([
  '.github/workflows/naming-audit.yml',
  'scripts/naming-audit-baseline.json',
  'scripts/naming-audit.ts',
]);

const FULL_SCAN_DIRECTORIES: readonly string[] = ['scripts/naming-audit/'];

/** Return whether a changed repository path can alter Naming Audit behaviour. */
export function requiresNamingAuditFullScan(filePath: string): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/');
  return (
    FULL_SCAN_FILES.has(normalizedPath) ||
    FULL_SCAN_DIRECTORIES.some((directory) => normalizedPath.startsWith(directory))
  );
}
