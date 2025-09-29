/**
 * SpreadsheetDialogExtension
 * - Provides step state evaluator for Spreadsheet steps (2: data source, 3: filtering)
 */

import { BaseFolderPlugin } from '@hierarchidb/plugins-folder-plugin';
import { isDataSourceComplete, type SpreadsheetDialogData } from '../steps/DataSourceStep.js';
import { STEP_CONFIG } from '../extension/constants.js';

export class SpreadsheetDialogExtension extends BaseFolderPlugin {
  readonly pluginId = 'spreadsheet-plugin-dialog-extension';
  readonly pluginName = 'Spreadsheet Dialog Extension';
  readonly pluginDescription = 'Adds Spreadsheet step evaluators to plugin dialogs';
  readonly pluginVersion = '1.0.0';

  protected getStepStateEvaluator() {
    const dataSourceStep = STEP_CONFIG.DATA_SOURCE.NUMBER;
    const filteringStep = STEP_CONFIG.FILTERING.NUMBER;

    const evaluate = (rawData: unknown) => {
      const dialogData = (typeof rawData === 'object' && rawData !== null)
        ? rawData as Partial<SpreadsheetDialogData>
        : {};

      const dataSourceValid = isDataSourceComplete(dialogData);

      return new Map<number, { enabled: boolean; validated: boolean }>([
        [dataSourceStep, { enabled: true, validated: dataSourceValid }],
        [filteringStep, { enabled: dataSourceValid, validated: true }],
      ]);
    };

    const resolveStepNumbers = (stepNumbers?: number[]) => (
      Array.isArray(stepNumbers) && stepNumbers.length > 0
        ? stepNumbers
        : [dataSourceStep, filteringStep]
    );

    return {
      getValidatedSteps: (data: any, stepNumbers?: number[]) => {
        const state = evaluate(data);
        return resolveStepNumbers(stepNumbers).map((num) => state.get(num)?.validated ?? true);
      },
      getEnabledSteps: (data: any, stepNumbers?: number[]) => {
        const state = evaluate(data);
        return resolveStepNumbers(stepNumbers).map((num) => state.get(num)?.enabled ?? true);
      },
    };
  }

  protected getSubmitEligibility() {
    return (data: any) => isDataSourceComplete(
      (typeof data === 'object' && data !== null)
        ? data as Partial<SpreadsheetDialogData>
        : {},
    );
  }
}

export const spreadsheetDialogExtension = new SpreadsheetDialogExtension();
export async function initializeSpreadsheetDialogExtension() { await spreadsheetDialogExtension.initialize(); }
