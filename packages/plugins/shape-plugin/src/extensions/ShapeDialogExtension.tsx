/**
 * ShapeDialogExtension
 * - Provides dialog steps for the Shape plugin and accompanying evaluators.
 */

import type { DialogStepDefinition, PeerEntity } from '@hierarchidb/common-type';
import { NodeDialogPlugin, wrapDialogStepComponent } from '@hierarchidb/plugins-base-plugin';

// Reuse existing step components from the Shape plugin
import { DataSourceStep } from '../extension/components/DataSourceStep.js';
import { LicenseStep } from '../extension/components/LicenseStep.js';
import { ProcessingStep } from '../extension/components/ProcessingStep.js';
import { CountrySelectionStep } from '../extension/components/CountrySelectionStep.js';

type ShapeDialogPeer = PeerEntity<Record<string, unknown>>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const toDialogRecord = (value: ShapeDialogPeer): Record<string, unknown> => (
  isRecord(value) ? value : {}
);

const asNumberArray = (values: unknown): number[] => (
  Array.isArray(values)
    ? values.filter((v): v is number => typeof v === 'number')
    : []
);

const asStringArray = (values: unknown): string[] => (
  Array.isArray(values)
    ? values.filter((v): v is string => typeof v === 'string')
    : []
);

const resolveStepNumbers = (stepNumbers: ReadonlyArray<number> | undefined, fallback: number[]): number[] => (
  stepNumbers && stepNumbers.length > 0
    ? Array.from(stepNumbers)
    : fallback
);

export class ShapeDialogExtension extends NodeDialogPlugin<ShapeDialogPeer> {
  readonly pluginId = 'shape-plugin-dialog-extension';
  readonly pluginName = 'Shape Dialog Extension';
  readonly pluginDescription = 'Adds shape-related dialog steps for the Shape plugin';
  readonly pluginVersion = '1.0.0';

  protected getCreateDialogSteps(): DialogStepDefinition[] {
    return [
      {
        stepNumber: 2,
        title: 'Data Source',
        component: wrapDialogStepComponent(DataSourceStep),
        validation: {
          validate: async (data: any) => {
            const ok = !!data?.dataSourceName;
            return ok ? { valid: true } : { valid: false, message: 'Data source selection is required' };
          },
        },
      },
      {
        stepNumber: 3,
        title: 'License Agreement',
        component: wrapDialogStepComponent(LicenseStep),
        dependsOn: [2],
        validation: {
          validate: async (data: any) => {
            const ok = data?.licenseAgreement === true;
            return ok ? { valid: true } : { valid: false, message: 'You must accept the license agreement' };
          },
        },
      },
      {
        stepNumber: 4,
        title: 'Processing Configuration',
        component: wrapDialogStepComponent(ProcessingStep),
        dependsOn: [3],
        validation: {
          validate: async (data: any) => {
            const levels: number[] | undefined = data?.selectedAdminLevels;
            const ok = Array.isArray(levels) && levels.length > 0 && levels.every((l) => l >= 0 && l <= 3);
            return ok ? { valid: true } : { valid: false, message: 'Select administrative levels (0-3) — at least one' };
          },
        },
      },
      {
        stepNumber: 5,
        title: 'Country Selection',
        component: wrapDialogStepComponent(CountrySelectionStep),
        dependsOn: [4],
        validation: {
          validate: async (data: any) => {
            const countries: string[] | undefined = data?.selectedCountries;
            const ok = Array.isArray(countries) && countries.length > 0 && countries.every((c) => typeof c === 'string' && c.length >= 2);
            return ok ? { valid: true } : { valid: false, message: 'Select at least one country' };
          },
        },
      },
    ];
  }

  protected getEditDialogSteps(): DialogStepDefinition[] {
    return this.getCreateDialogSteps();
  }

  protected getStepStateEvaluator() {
    return {
      getValidatedSteps: (data: ShapeDialogPeer, stepNumbers?: ReadonlyArray<number>) => {
        const dialogData = toDialogRecord(data) as any;
        return resolveStepNumbers(stepNumbers, [2, 3, 4, 5]).map((n) => {
          switch (n) {
            case 2:
              return !!dialogData?.dataSourceName;
            case 3:
              return dialogData?.licenseAgreement === true;
            case 4: {
              const levels = asNumberArray(dialogData?.selectedAdminLevels);
              return levels.length > 0 && levels.every((l) => l >= 0 && l <= 3);
            }
            case 5: {
              const countries = asStringArray(dialogData?.selectedCountries);
              return countries.length > 0 && countries.every((c) => c.length >= 2);
            }
            default:
              return true;
          }
        });
      },
      getEnabledSteps: (data: ShapeDialogPeer, stepNumbers?: ReadonlyArray<number>) => {
        const dialogData = toDialogRecord(data) as any;
        const filledByNumber = new Map<number, boolean>();
        // Evaluate filled quickly for dependency checks
        [2, 3, 4, 5].forEach((n) => {
          switch (n) {
            case 2:
              filledByNumber.set(2, !!dialogData?.dataSourceName);
              break;
            case 3:
              filledByNumber.set(3, dialogData?.licenseAgreement === true);
              break;
            case 4: {
              const levels = asNumberArray(dialogData?.selectedAdminLevels);
              filledByNumber.set(4, levels.length > 0 && levels.every((l) => l >= 0 && l <= 3));
              break;
            }
            case 5: {
              const countries = asStringArray(dialogData?.selectedCountries);
              filledByNumber.set(5, countries.length > 0 && countries.every((c) => c.length >= 2));
              break;
            }
          }
        });

        return resolveStepNumbers(stepNumbers, [2, 3, 4, 5]).map((n) => {
          if (n === 2) return true;
          if (n === 3) return filledByNumber.get(2) === true;
          if (n === 4) return filledByNumber.get(3) === true;
          if (n === 5) return filledByNumber.get(4) === true;
          return true;
        });
      },
    };
  }

  protected getSubmitEligibility() {
    return (data: ShapeDialogPeer) => {
      const dialogData = toDialogRecord(data) as any;
      const hasDataSource = !!dialogData?.dataSourceName;
      const accepted = dialogData?.licenseAgreement === true;
      const levels = asNumberArray(dialogData?.selectedAdminLevels);
      const hasLevels = levels.length > 0 && levels.every((l) => l >= 0 && l <= 3);
      const countries = asStringArray(dialogData?.selectedCountries);
      const hasCountries = countries.length > 0 && countries.every((c) => c.length >= 2);
      return hasDataSource && accepted && hasLevels && hasCountries;
    };
  }
}

export const shapeDialogExtension = new ShapeDialogExtension();

export async function initializeShapeDialogExtension(): Promise<void> {
  await shapeDialogExtension.initialize();
}
