/**
 * SpreadsheetDialogExtension
 * - Provides step state evaluator for Spreadsheet steps (2: data source, 3: filtering)
 */

import type { PeerEntity } from '@hierarchidb/common-types';
import { NodeDialogPlugin } from '@hierarchidb/plugin-api';

import { STEP_CONFIG } from '../extension/constants.js';
import { isDataSourceComplete, SpreadsheetDialogData } from '~/ui/components/steps/DataSourceStep.js';

type SpreadsheetPeerEntity = PeerEntity<Record<string, unknown>>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

export class SpreadsheetDialogExtension extends NodeDialogPlugin<SpreadsheetPeerEntity> {
  readonly pluginId = 'spreadsheet-plugin-dialog-extension';
  readonly pluginName = 'Spreadsheet Dialog Extension';
  readonly pluginDescription = 'Adds Spreadsheet step evaluators to plugin dialogs';
  readonly pluginVersion = '1.0.0';

  protected getStepStateEvaluator() {
    const dataSourceStep = STEP_CONFIG.DATA_SOURCE.NUMBER;
    const filteringStep = STEP_CONFIG.FILTERING.NUMBER;

    const evaluate = (rawData: SpreadsheetPeerEntity) => {
      const dialogData = isRecord(rawData)
        ? rawData as Partial<SpreadsheetDialogData>
        : {};

      const dataSourceValid = isDataSourceComplete(dialogData);

      return new Map<number, { enabled: boolean; validated: boolean }>([
        [dataSourceStep, { enabled: true, validated: dataSourceValid }],
        [filteringStep, { enabled: dataSourceValid, validated: true }],
      ]);
    };

    const resolveStepNumbers = (stepNumbers?: ReadonlyArray<number>) => (
      stepNumbers && stepNumbers.length > 0
        ? Array.from(stepNumbers)
        : [dataSourceStep, filteringStep]
    );

    return {
      getValidatedSteps: (data: SpreadsheetPeerEntity, stepNumbers?: ReadonlyArray<number>) => {
        const state = evaluate(data);
        return resolveStepNumbers(stepNumbers).map((num) => state.get(num)?.validated ?? true);
      },
      getEnabledSteps: (data: SpreadsheetPeerEntity, stepNumbers?: ReadonlyArray<number>) => {
        const state = evaluate(data);
        return resolveStepNumbers(stepNumbers).map((num) => state.get(num)?.enabled ?? true);
      },
    };
  }

  protected getSubmitEligibility() {
    return (data: SpreadsheetPeerEntity) => isDataSourceComplete(
      isRecord(data) ? (data as Partial<SpreadsheetDialogData>) : {},
    );
  }
}

export const spreadsheetDialogExtension = new SpreadsheetDialogExtension();
export async function initializeSpreadsheetDialogExtension(): Promise<void> {
  await spreadsheetDialogExtension.initialize();
}
