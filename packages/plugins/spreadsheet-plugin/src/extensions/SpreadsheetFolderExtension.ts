/**
 * SpreadsheetFolderExtension
 * - Provides step state evaluator for Spreadsheet steps (2: data source, 3: filtering)
 */

import { BaseFolderPlugin } from '@hierarchidb/plugins-folder-plugin';

export class SpreadsheetFolderExtension extends BaseFolderPlugin {
  readonly pluginId = 'spreadsheet-plugin-folder-extension';
  readonly pluginName = 'Spreadsheet (Folder Extension)';
  readonly pluginDescription = 'Adds Spreadsheet step evaluators to folder dialog';
  readonly pluginVersion = '1.0.0';

  protected getStepStateEvaluator() {
    return {
      getFilledSteps: (data: any, stepNumbers?: number[]) => {
        const nums = stepNumbers || [];
        return nums.map((n) => {
          if (n === 2) {
            const ds = data?.dataSource;
            if (!ds) return false;
            if (ds.type === 'file') {
              const hasFile = !!data?.file?.name || !!ds.source;
              return !!hasFile;
            }
            // url/manual require presence of source
            if (ds.type === 'url' || ds.type === 'manual') {
              return !!ds.source;
            }
            return true;
          }
          if (n === 3) {
            return true; // filtering step is optional / always passable
          }
          return true;
        });
      },
      getNavigableSteps: (data: any, stepNumbers?: number[]) => {
        const nums = stepNumbers || [];
        const filled2 = (() => {
          const ds = data?.dataSource;
          if (!ds) return false;
          if (ds.type === 'file') return !!data?.file?.name || !!ds.source;
          if (ds.type === 'url' || ds.type === 'manual') return !!ds.source;
          return true;
        })();
        return nums.map((n) => {
          if (n === 2) return true;
          if (n === 3) return filled2;
          return true;
        });
      },
    };
  }

  protected getSubmitEligibility() {
    return (data: any) => {
      const ds = data?.dataSource;
      if (!ds) return false;
      if (ds.type === 'file') return !!data?.file?.name || !!ds.source;
      if (ds.type === 'url' || ds.type === 'manual') return !!ds.source;
      return true;
    };
  }
}

export const spreadsheetFolderExtension = new SpreadsheetFolderExtension();
export async function initializeSpreadsheetFolderExtension() { await spreadsheetFolderExtension.initialize(); }
