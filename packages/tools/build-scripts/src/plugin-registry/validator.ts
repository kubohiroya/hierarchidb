import type { ManifestSummary, PluginSpecifierMode } from './types.ts';
import { hasExportPath } from './entry-resolver.ts';

export function validateEntryPaths(summaries: ManifestSummary[], mode: PluginSpecifierMode): void {
  const issues: string[] = [];

  for (const summary of summaries) {
    const exportPaths = summary.exportPaths;
    const uiExported = hasExportPath(exportPaths, 'ui');
    const workerExported = hasExportPath(exportPaths, 'worker');
    const databaseExported =
      hasExportPath(exportPaths, 'database') || hasExportPath(exportPaths, 'worker/database');

    const hasUiEntry = Boolean(summary.uiSourceEntry || summary.uiDistEntry);
    const hasWorkerEntry = Boolean(summary.workerSourceEntry || summary.workerDistEntry);
    const hasDatabaseEntry = Boolean(summary.databaseSourceEntry || summary.databaseDistEntry);

    if (uiExported && !hasUiEntry) {
      issues.push(`${summary.nodeType}: export "ui" declared but entry file not found.`);
    }
    if (workerExported && !hasWorkerEntry) {
      issues.push(`${summary.nodeType}: export "worker" declared but entry file not found.`);
    }
    if (databaseExported && !hasDatabaseEntry) {
      issues.push(`${summary.nodeType}: export "database" declared but entry file not found.`);
    }

    if (mode === 'package') {
      if (hasUiEntry && !uiExported) {
        issues.push(`${summary.nodeType}: UI entry exists but package export "ui" is missing.`);
      }
      if (hasWorkerEntry && !workerExported) {
        issues.push(`${summary.nodeType}: worker entry exists but package export "worker" is missing.`);
      }
      if (hasDatabaseEntry && !databaseExported) {
        issues.push(`${summary.nodeType}: database entry exists but package export "database" is missing.`);
      }

      const iconSpecifier = summary.iconComponent?.specifier ?? '';
      if (iconSpecifier.startsWith(summary.packageName) && !hasExportPath(exportPaths, 'icon')) {
        issues.push(`${summary.nodeType}: icon specifier points into package but export "icon" is missing.`);
      }
    }
  }

  if (issues.length > 0) {
    console.warn('[generate-plugin-registry] Entry path validation warnings:\n- ' + issues.join('\n- '));
  }
}
