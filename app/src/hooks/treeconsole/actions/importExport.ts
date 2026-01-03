/**
 * Import/export actions for TreeConsole.
 */

import type { TreeConsoleActionDeps } from '../types.js';
import { fireCmdEvent } from './helpers.ts';

export const createImportExportActions = (deps: TreeConsoleActionDeps) => {
  const { importExport, loadChildrenOf, pageNodeId, refreshUndoRedo, selectedIds, setState } = deps;

  return {
    handleImport: async () => {
      console.log('Import action triggered');
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,.csv';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file && pageNodeId) {
          const detected = importExport.detectFileFormat(file) ?? null;
          const isSupported = (v: string | null): v is 'json' | 'csv' =>
            v === 'json' || v === 'csv';
          const format: 'json' | 'csv' = isSupported(detected) ? detected : 'json';
          try {
            await importExport.importFile({
              file,
              targetNodeId: pageNodeId,
              format,
              onProgress: (progress) => {
                console.log('Import progress:', progress);
              },
            });
            await loadChildrenOf(pageNodeId);
            await refreshUndoRedo();
            fireCmdEvent();
          } catch (error) {
            console.error('Import failed:', error);
            setState((prev) => ({
              ...prev,
              error: `Import failed: ${error}`,
            }));
          }
        }
      };
      input.click();
    },

    handleExport: async () => {
      console.log('Export action triggered');
      if (selectedIds.length === 0) {
        console.warn('No nodes selected for export');
        return;
      }

      try {
        const blob = await importExport.exportNodes({
          nodeIds: selectedIds,
          format: 'json',
          includeChildren: true,
          onProgress: (progress) => {
            console.log('Export progress:', progress);
          },
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `export-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log('Export completed');
      } catch (error) {
        console.error('Export failed:', error);
        setState((prev) => ({
          ...prev,
          error: `Export failed: ${error}`,
        }));
      }
    },
  };
};
