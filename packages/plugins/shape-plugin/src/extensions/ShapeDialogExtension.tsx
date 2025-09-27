/**
 * ShapeDialogExtension
 * - Provides folder-plugin dialog steps (same as ShapeExtension) and a step state evaluator.
 */

import { BaseDialogPlugin, wrapDialogStepComponent } from '@hierarchidb/plugins-folder-plugin';
import type { DialogStepDefinition } from '@hierarchidb/common-type';

// Reuse existing step components from the Shape plugin
import { DataSourceStep } from '../extension/components/DataSourceStep.js';
import { LicenseStep } from '../extension/components/LicenseStep.js';
import { ProcessingStep } from '../extension/components/ProcessingStep.js';
import { CountrySelectionStep } from '../extension/components/CountrySelectionStep.js';

interface ShapeDialogData {
  dataSourceName?: string;
  licenseAgreement?: boolean;
  selectedAdminLevels?: number[];
  selectedCountries?: string[];
  [key: string]: unknown;
}

export class ShapeDialogExtension extends BaseDialogPlugin<ShapeDialogData> {
  readonly pluginId = 'shape-plugin-folder-extension';
  readonly pluginName = 'Shape (Dialog Extension)';
  readonly pluginDescription = 'Adds shape-related steps to the shared node dialog';
  readonly pluginVersion = '1.0.0';

  protected getCreateDialogSteps(): DialogStepDefinition[] {
    return [
      {
        stepNumber: 2,
        title: 'Data Source',
        component: wrapDialogStepComponent(DataSourceStep),
        validation: {
          validate: async (data: ShapeDialogData) => {
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
          validate: async (data: ShapeDialogData) => {
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
          validate: async (data: ShapeDialogData) => {
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
          validate: async (data: ShapeDialogData) => {
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
    const evaluateValidated = (data: ShapeDialogData, stepNumbers?: number[]) => {
      const nums = stepNumbers ?? [];
      return nums.map((stepNumber) => {
        switch (stepNumber) {
          case 2:
            return !!data?.dataSourceName;
          case 3:
            return data?.licenseAgreement === true;
          case 4: {
            const levels: number[] | undefined = data?.selectedAdminLevels;
            return Array.isArray(levels) && levels.length > 0 && levels.every((level) => level >= 0 && level <= 3);
          }
          case 5: {
            const countries: string[] | undefined = data?.selectedCountries;
            return Array.isArray(countries) && countries.length > 0 && countries.every((country) => typeof country === 'string' && country.length >= 2);
          }
          default:
            return true;
        }
      });
    };

    const evaluateEnabled = (data: ShapeDialogData, stepNumbers?: number[]) => {
      const nums = stepNumbers ?? [];
      const validatedByNumber = new Map<number, boolean>();

      // Pre-compute validation state for dependency evaluation
      [2, 3, 4, 5].forEach((stepNumber) => {
        switch (stepNumber) {
          case 2:
            validatedByNumber.set(2, !!data?.dataSourceName);
            break;
          case 3:
            validatedByNumber.set(3, data?.licenseAgreement === true);
            break;
          case 4: {
            const levels: number[] | undefined = data?.selectedAdminLevels;
            validatedByNumber.set(4, Array.isArray(levels) && levels.length > 0 && levels.every((level) => level >= 0 && level <= 3));
            break;
          }
          case 5: {
            const countries: string[] | undefined = data?.selectedCountries;
            validatedByNumber.set(5, Array.isArray(countries) && countries.length > 0 && countries.every((country) => typeof country === 'string' && country.length >= 2));
            break;
          }
        }
      });

      return nums.map((stepNumber) => {
        if (stepNumber === 2) return true;
        if (stepNumber === 3) return validatedByNumber.get(2) === true;
        if (stepNumber === 4) return validatedByNumber.get(3) === true;
        if (stepNumber === 5) return validatedByNumber.get(4) === true;
        return true;
      });
    };

    return {
      getNavigableSteps: evaluateEnabled,
      getFilledSteps: evaluateValidated,
      // TODO: drop legacy keys once all callers migrate to the new interface
      getEnabledSteps: evaluateEnabled,
      getValidatedSteps: evaluateValidated,
    };
  }

  protected getSubmitEligibility() {
    return (data: ShapeDialogData) => {
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

export const shapeDialogExtension = new ShapeDialogExtension();

export async function initializeShapeDialogExtension() {
  await shapeDialogExtension.initialize();
}
