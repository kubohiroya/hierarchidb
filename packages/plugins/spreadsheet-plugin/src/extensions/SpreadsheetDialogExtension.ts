/**
 * SpreadsheetDialogExtension
 * - Provides step state evaluator for Spreadsheet steps (2: data source, 3: filtering)
 */

import { BaseDialogPlugin } from '@hierarchidb/plugins-base-plugin';
import type { DraftPeerEntity } from '@hierarchidb/common-type';

interface SpreadsheetDialogFields {
  dataSource?: {
    type: 'file' | 'url' | 'manual' | string;
    source?: string;
  };
  file?: {
    name?: string;
  };
  [key: string]: unknown;
}

type SpreadsheetDialogDraft = DraftPeerEntity<SpreadsheetDialogFields>;

export class SpreadsheetDialogExtension extends BaseDialogPlugin<SpreadsheetDialogDraft> {
  readonly pluginId = 'spreadsheet-plugin-folder-extension';
  readonly pluginName = 'Spreadsheet (Dialog Extension)';
  readonly pluginDescription = 'Adds Spreadsheet step evaluators to the shared dialog';
  readonly pluginVersion = '1.0.0';

  protected getStepStateEvaluator() {
    const evaluateValidated = (
      data: SpreadsheetDialogDraft,
      stepNumbers?: ReadonlyArray<number>,
    ) => {
      const nums = stepNumbers ? [...stepNumbers] : [];
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
    };

    const evaluateEnabled = (
      data: SpreadsheetDialogDraft,
      stepNumbers?: ReadonlyArray<number>,
    ) => {
      const nums = stepNumbers ? [...stepNumbers] : [];
      const isSourceConfigured = (() => {
        const ds = data?.dataSource;
        if (!ds) return false;
        if (ds.type === 'file') return !!data?.file?.name || !!ds.source;
        if (ds.type === 'url' || ds.type === 'manual') return !!ds.source;
        return true;
      })();

      return nums.map((n) => {
        if (n === 2) return true;
        if (n === 3) return isSourceConfigured;
        return true;
      });
    };

    return {
      getEnabledSteps: evaluateEnabled,
      getValidatedSteps: evaluateValidated,
    };
  }

  protected getSubmitEligibility() {
    return (data: SpreadsheetDialogDraft) => {
      const ds = data?.dataSource;
      if (!ds) return false;
      if (ds.type === 'file') return !!data?.file?.name || !!ds.source;
      if (ds.type === 'url' || ds.type === 'manual') return !!ds.source;
      return true;
    };
  }
}

export const spreadsheetDialogExtension = new SpreadsheetDialogExtension();
export async function initializeSpreadsheetDialogExtension() { await spreadsheetDialogExtension.initialize(); }
