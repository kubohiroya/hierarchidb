/**
 * ShapeDialogExtension
 * - Provides dialog steps for the Shape plugin and accompanying evaluators.
 */

import type { DialogStepDefinition, PeerEntity, StepValidation } from '@hierarchidb/common-type';
import { NodeDialogPlugin, wrapDialogStepComponent } from '@hierarchidb/plugins-base-plugin';

// Reuse existing step components from the Shape plugin
import { DataSourceStep } from '../extension/components/DataSourceStep.js';
import { LicenseStep } from '../extension/components/LicenseStep.js';
import { ProcessingStep } from '../extension/components/ProcessingStep.js';
import { CountrySelectionStep } from '../extension/components/CountrySelectionStep.js';

type ShapeDialogPeer = PeerEntity<Record<string, unknown>>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

interface ShapeDialogData {
  dataSourceName?: string;
  licenseAgreement: boolean;
  selectedAdminLevels: number[];
  selectedCountries: string[];
}

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

const toDialogData = (value: unknown): ShapeDialogData => {
  if (!isRecord(value)) {
    return { licenseAgreement: false, selectedAdminLevels: [], selectedCountries: [] };
  }
  const raw = value as Record<string, unknown>;
  return {
    dataSourceName: typeof raw['dataSourceName'] === 'string' ? (raw['dataSourceName'] as string) : undefined,
    licenseAgreement: raw['licenseAgreement'] === true,
    selectedAdminLevels: asNumberArray(raw['selectedAdminLevels']),
    selectedCountries: asStringArray(raw['selectedCountries']),
  };
};

const resolveStepNumbers = (stepNumbers: ReadonlyArray<number> | undefined, fallback: number[]): number[] => (
  stepNumbers && stepNumbers.length > 0
    ? Array.from(stepNumbers)
    : fallback
);

const validateDataSourceStep: StepValidation = {
  validate: async (data) => {
    const dialogData = toDialogData(data);
    const ok = typeof dialogData.dataSourceName === 'string' && dialogData.dataSourceName.length > 0;
    return ok ? { valid: true } : { valid: false, message: 'Data source selection is required' };
  },
};

const validateLicenseStep: StepValidation = {
  validate: async (data) => {
    const dialogData = toDialogData(data);
    const ok = dialogData.licenseAgreement === true;
    return ok ? { valid: true } : { valid: false, message: 'You must accept the license agreement' };
  },
};

const validateProcessingStep: StepValidation = {
  validate: async (data) => {
    const dialogData = toDialogData(data);
    const levels = dialogData.selectedAdminLevels;
    const ok = levels.length > 0 && levels.every((l) => l >= 0 && l <= 3);
    return ok ? { valid: true } : { valid: false, message: 'Select administrative levels (0-3) — at least one' };
  },
};

const validateCountryStep: StepValidation = {
  validate: async (data) => {
    const dialogData = toDialogData(data);
    const countries = dialogData.selectedCountries;
    const ok = countries.length > 0 && countries.every((c) => c.length >= 2);
    return ok ? { valid: true } : { valid: false, message: 'Select at least one country' };
  },
};

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
          validate: validateDataSourceStep.validate,
        },
      },
      {
        stepNumber: 3,
        title: 'License Agreement',
        component: wrapDialogStepComponent(LicenseStep),
        dependsOn: [2],
        validation: {
          validate: validateLicenseStep.validate,
        },
      },
      {
        stepNumber: 4,
        title: 'Processing Configuration',
        component: wrapDialogStepComponent(ProcessingStep),
        dependsOn: [3],
        validation: {
          validate: validateProcessingStep.validate,
        },
      },
      {
        stepNumber: 5,
        title: 'Country Selection',
        component: wrapDialogStepComponent(CountrySelectionStep),
        dependsOn: [4],
        validation: {
          validate: validateCountryStep.validate,
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
        const dialogData = toDialogData(data);
        return resolveStepNumbers(stepNumbers, [2, 3, 4, 5]).map((n) => {
          switch (n) {
            case 2:
              return typeof dialogData.dataSourceName === 'string' && dialogData.dataSourceName.length > 0;
            case 3:
              return dialogData.licenseAgreement === true;
            case 4: {
              const levels = dialogData.selectedAdminLevels;
              return levels.length > 0 && levels.every((l) => l >= 0 && l <= 3);
            }
            case 5: {
              const countries = dialogData.selectedCountries;
              return countries.length > 0 && countries.every((c) => c.length >= 2);
            }
            default:
              return true;
          }
        });
      },
      getEnabledSteps: (data: ShapeDialogPeer, stepNumbers?: ReadonlyArray<number>) => {
        const dialogData = toDialogData(data);
        const filledByNumber = new Map<number, boolean>();
        // Evaluate filled quickly for dependency checks
        [2, 3, 4, 5].forEach((n) => {
          switch (n) {
            case 2:
              filledByNumber.set(2, typeof dialogData.dataSourceName === 'string' && dialogData.dataSourceName.length > 0);
              break;
            case 3:
              filledByNumber.set(3, dialogData.licenseAgreement === true);
              break;
            case 4: {
              const levels = dialogData.selectedAdminLevels;
              filledByNumber.set(4, levels.length > 0 && levels.every((l) => l >= 0 && l <= 3));
              break;
            }
            case 5: {
              const countries = dialogData.selectedCountries;
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
      const dialogData = toDialogData(data);
      const hasDataSource = typeof dialogData.dataSourceName === 'string' && dialogData.dataSourceName.length > 0;
      const accepted = dialogData.licenseAgreement === true;
      const levels = dialogData.selectedAdminLevels;
      const hasLevels = levels.length > 0 && levels.every((l) => l >= 0 && l <= 3);
      const countries = dialogData.selectedCountries;
      const hasCountries = countries.length > 0 && countries.every((c) => c.length >= 2);
      return hasDataSource && accepted && hasLevels && hasCountries;
    };
  }
}

export const shapeDialogExtension = new ShapeDialogExtension();

export async function initializeShapeDialogExtension(): Promise<void> {
  await shapeDialogExtension.initialize();
}
