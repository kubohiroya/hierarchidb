/**
 * StylerDialogExtension
 * - Provides dialog steps and evaluators for the Styler plugin using the base NodeDialogPlugin.
 */

import type { PeerEntity } from '@hierarchidb/common-types';
import {
  NodeDialogPlugin,
  type NodeDialogStepDefinition,
  wrapDialogStepComponent,
} from '@hierarchidb/plugin-ui-sdk';
import { StylerStep5 } from '../../ui/components/steps/StylerStep5.js';
import { StylerStep6 } from '../../ui/components/steps/StylerStep6.js';
import type { StylerConfig } from '../types/stylerTypes.js';

type StylerDialogPeer = PeerEntity<Record<string, unknown>>;

type StylerDialogRecord = Record<string, unknown> & {
  stylerConfig?: Partial<StylerConfig> | Record<string, unknown>;
  selectedValueColumn?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toDialogRecord = (value: StylerDialogPeer): StylerDialogRecord =>
  isRecord(value) ? (value as StylerDialogRecord) : {};

const resolveStepNumbers = (stepNumbers: ReadonlyArray<number> | undefined): number[] =>
  stepNumbers && stepNumbers.length > 0 ? Array.from(stepNumbers) : [5, 6];

const readNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const hasStylerConfiguration = (dialogData: StylerDialogRecord): boolean => {
  const configCandidate = isRecord(dialogData.stylerConfig)
    ? (dialogData.stylerConfig as Record<string, unknown>)
    : dialogData.stylerConfig;

  if (!configCandidate || typeof configCandidate !== 'object') {
    return false;
  }

  const config = configCandidate as Record<string, unknown>;

  const targetProperty =
    typeof config.targetProperty === 'string' ? config.targetProperty.trim() : '';
  const mappingCandidate = config.mapping;
  const mapping = isRecord(mappingCandidate)
    ? (mappingCandidate as Record<string, unknown>)
    : undefined;

  const min = mapping ? readNumber(mapping.min) : null;
  const max = mapping ? readNumber(mapping.max) : null;
  const selectedValueColumn =
    typeof dialogData.selectedValueColumn === 'string' ? dialogData.selectedValueColumn.trim() : '';

  return Boolean(
    targetProperty && selectedValueColumn && min !== null && max !== null && min < max
  );
};

const StylerStep5Component = wrapDialogStepComponent(StylerStep5);
const StylerStep6Component = wrapDialogStepComponent(StylerStep6);

const STYLER_STEP_DEFINITIONS: NodeDialogStepDefinition[] = [
  {
    stepNumber: 5,
    title: 'Style Mapping Configuration',
    component: StylerStep5Component,
    dependsOn: [4],
    validation: {
      validate: async (data: unknown) =>
        hasStylerConfiguration(toDialogRecord(data as StylerDialogPeer))
          ? { valid: true }
          : {
              valid: false,
              message:
                'Styler configuration requires a target property, value column, and valid range.',
            },
    },
  },
  {
    stepNumber: 6,
    title: 'Preview with Style Mapping',
    component: StylerStep6Component,
    dependsOn: [5],
    validation: {
      validate: async () => ({ valid: true }),
    },
    isOptional: true,
  },
];

const cloneStepDefinitions = (): NodeDialogStepDefinition[] =>
  STYLER_STEP_DEFINITIONS.map((step) => ({
    ...step,
    dependsOn: step.dependsOn ? [...step.dependsOn] : undefined,
    validation: step.validation ? { ...step.validation } : undefined,
  }));

const evaluateStylerSteps = (data: StylerDialogPeer) => {
  const dialogData = toDialogRecord(data);
  const step5Complete = hasStylerConfiguration(dialogData);

  return new Map<number, { enabled: boolean; validated: boolean }>([
    [5, { enabled: true, validated: step5Complete }],
    [6, { enabled: step5Complete, validated: true }],
  ]);
};

export class StylerDialogExtension extends NodeDialogPlugin<StylerDialogPeer> {
  readonly pluginId = 'styler-plugin-dialog-extension';
  readonly pluginName = 'Styler Dialog Extension';
  readonly pluginDescription = 'Adds Styler dialog steps to plugin dialogs';
  readonly pluginVersion = '1.0.0';
  protected readonly dependencies = ['spreadsheet-plugin-dialog-extension'];

  protected getCreateDialogSteps(): NodeDialogStepDefinition[] {
    return cloneStepDefinitions();
  }

  protected getEditDialogSteps(): NodeDialogStepDefinition[] {
    return cloneStepDefinitions();
  }

  protected getStepStateEvaluator() {
    return {
      getValidatedSteps: (data: StylerDialogPeer, stepNumbers?: ReadonlyArray<number>) => {
        const state = evaluateStylerSteps(data);
        return resolveStepNumbers(stepNumbers).map((num) => state.get(num)?.validated ?? true);
      },
      getEnabledSteps: (data: StylerDialogPeer, stepNumbers?: ReadonlyArray<number>) => {
        const state = evaluateStylerSteps(data);
        return resolveStepNumbers(stepNumbers).map((num) => state.get(num)?.enabled ?? true);
      },
    };
  }

  protected getSubmitEligibility() {
    return (data: StylerDialogPeer) => hasStylerConfiguration(toDialogRecord(data));
  }
}

export const stylerDialogExtension = new StylerDialogExtension();

export async function initializeStylerDialogExtension(): Promise<void> {
  await stylerDialogExtension.initialize();
}
