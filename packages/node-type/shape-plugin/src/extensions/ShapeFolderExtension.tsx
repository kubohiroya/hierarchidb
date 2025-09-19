/**
 * ShapeFolderExtension
 * - Provides folder-plugin dialog steps (same as ShapeExtension) and a step state evaluator.
 */

import { BaseFolderPlugin, wrapDialogStepComponent } from '@hierarchidb/node-type-folder-plugin';
import type { DialogStepDefinition } from '@hierarchidb/common-type';

// Reuse existing step components from the Shape plugin
import { DataSourceStep } from '../extension/components/DataSourceStep.js';
import { LicenseStep } from '../extension/components/LicenseStep.js';
import { ProcessingStep } from '../extension/components/ProcessingStep.js';
import { CountrySelectionStep } from '../extension/components/CountrySelectionStep.js';

export class ShapeFolderExtension extends BaseFolderPlugin {
  readonly pluginId = 'shape-plugin-folder-extension';
  readonly pluginName = 'Shape (Folder Extension)';
  readonly pluginDescription = 'Adds shape-related steps to folder dialog';
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
      getFilledSteps: (data: any, stepNumbers?: number[]) => {
        const nums = stepNumbers || [];
        return nums.map((n) => {
          switch (n) {
            case 2:
              return !!data?.dataSourceName;
            case 3:
              return data?.licenseAgreement === true;
            case 4: {
              const levels: number[] | undefined = data?.selectedAdminLevels;
              return Array.isArray(levels) && levels.length > 0 && levels.every((l) => l >= 0 && l <= 3);
            }
            case 5: {
              const countries: string[] | undefined = data?.selectedCountries;
              return Array.isArray(countries) && countries.length > 0 && countries.every((c) => typeof c === 'string' && c.length >= 2);
            }
            default:
              return true;
          }
        });
      },
      getNavigableSteps: (data: any, stepNumbers?: number[]) => {
        const nums = stepNumbers || [];
        const filledByNumber = new Map<number, boolean>();
        // Evaluate filled quickly for dependency checks
        [2, 3, 4, 5].forEach((n) => {
          switch (n) {
            case 2:
              filledByNumber.set(2, !!data?.dataSourceName);
              break;
            case 3:
              filledByNumber.set(3, data?.licenseAgreement === true);
              break;
            case 4: {
              const levels: number[] | undefined = data?.selectedAdminLevels;
              filledByNumber.set(4, Array.isArray(levels) && levels.length > 0 && levels.every((l) => l >= 0 && l <= 3));
              break;
            }
            case 5: {
              const countries: string[] | undefined = data?.selectedCountries;
              filledByNumber.set(5, Array.isArray(countries) && countries.length > 0 && countries.every((c) => typeof c === 'string' && c.length >= 2));
              break;
            }
          }
        });

        return nums.map((n) => {
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
    return (data: any) => {
      const hasDataSource = !!data?.dataSourceName;
      const accepted = data?.licenseAgreement === true;
      const levels: number[] | undefined = data?.selectedAdminLevels;
      const hasLevels = Array.isArray(levels) && levels.length > 0 && levels.every((l) => l >= 0 && l <= 3);
      const countries: string[] | undefined = data?.selectedCountries;
      const hasCountries = Array.isArray(countries) && countries.length > 0 && countries.every((c) => typeof c === 'string' && c.length >= 2);
      return hasDataSource && accepted && hasLevels && hasCountries;
    };
  }
}

export const shapeFolderExtension = new ShapeFolderExtension();

export async function initializeShapeFolderExtension() {
  await shapeFolderExtension.initialize();
}
