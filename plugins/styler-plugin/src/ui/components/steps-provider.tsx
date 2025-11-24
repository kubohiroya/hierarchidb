import { PluginStepRegistry, type StepComponentProps } from '@hierarchidb/plugin-base';
// Reuse Spreadsheet steps as Step 2,3
import {
  DataSourceStep as SpreadsheetDataSourceStep,
  FilteringStep as SpreadsheetFilteringStep,
  type SpreadsheetDialogData,
} from '@hierarchidb/spreadsheet-plugin';
import { BasicInfoStep as SharedBasicInfoStep, type BasicInfoData } from '@hierarchidb/ui-plugin-basic-info';
import { normalizeBasicInfo } from '@hierarchidb/plugin-ui-sdk';
import { StylerStep5 } from './steps/StylerStep5.js';
import { StylerStep6 } from './steps/StylerStep6.js';
import { StyleSettingsStep, isStyleSettingsComplete } from './steps/StyleSettingsStep.js';
import type { StylerDialogData } from './types.js';

const registry = PluginStepRegistry.getInstance();

const normalizeDialogData = (value?: StylerDialogData): StylerDialogData => {
  const basic = normalizeBasicInfo({
    metadata: value?.basicInfo ?? {
      name: value?.name,
      description: value?.description,
      tags: value?.tags,
    },
  });
  return {
    ...(value ?? {}),
    spreadsheetMetadata: value?.spreadsheetMetadata ?? null,
    basicInfo: {
      name: basic.name,
      description: basic.description,
      tags: basic.tags,
    },
    name: basic.name,
    description: basic.description,
    tags: basic.tags,
  };
};

const toSpreadsheetDialogData = (value?: StylerDialogData): SpreadsheetDialogData => ({
  ...(normalizeDialogData(value)),
  metadata: normalizeDialogData(value).spreadsheetMetadata ?? null,
});

const mergeDialogData = (
  current: StylerDialogData | undefined,
  next: Partial<StylerDialogData>
): StylerDialogData => {
  const normalized = normalizeDialogData(current);
  return {
    ...normalized,
    ...next,
    spreadsheetMetadata: next.spreadsheetMetadata ?? normalized.spreadsheetMetadata,
    name: next.name ?? normalized.name,
    description: next.description ?? normalized.description,
    tags: next.tags ?? normalized.tags,
  };
};

const renderDataSourceStep = (p: StepComponentProps<StylerDialogData>) => (
  <SpreadsheetDataSourceStep
    {...(p as unknown as StepComponentProps<SpreadsheetDialogData>)}
    data={toSpreadsheetDialogData(p.data)}
    onChange={(next) =>
      p.onChange(
        mergeDialogData(p.data, {
          ...(next as Partial<StylerDialogData>),
          spreadsheetMetadata: next.metadata ?? null,
        })
      )
    }
  />
);

const renderFilteringStep = (p: StepComponentProps<StylerDialogData>) => (
  <SpreadsheetFilteringStep
    {...(p as unknown as StepComponentProps<SpreadsheetDialogData>)}
    data={toSpreadsheetDialogData(p.data)}
    onChange={(next) =>
      p.onChange(
        mergeDialogData(p.data, {
          ...(next as Partial<StylerDialogData>),
          spreadsheetMetadata: next.metadata ?? null,
        })
      )
    }
  />
);

registry.registerConfigProvider<StylerDialogData>({
  nodeType: 'styler',
  getCreateStepConfigs() {
    return [
      {
        id: 'basic-info',
        label: 'Basic Information',
        componentFactory: (p: StepComponentProps<StylerDialogData>) => {
          const dialogData = normalizeDialogData(p.data);
          return (
            <SharedBasicInfoStep
              name={dialogData.name ?? ''}
              description={dialogData.description ?? ''}
              tags={dialogData.tags ?? []}
              mode={p.mode}
              onChange={(value: BasicInfoData) =>
                p.onChange(
                  mergeDialogData(dialogData, {
                    basicInfo: {
                      name: value.name,
                      description: value.description,
                      tags: value.tags,
                    },
                    name: value.name,
                    description: value.description,
                    tags: value.tags,
                  })
                )
              }
              validate={({ name }) => (name.trim().length ? null : 'Name is required')}
            />
          );
        },
        validate: (dialogData?: StylerDialogData) => {
          const normalized = normalizeDialogData(dialogData);
          return Boolean(normalized.name?.trim());
        },
        capabilities: {
          canProceedToNext: (dialogData?: StylerDialogData) => {
            const normalized = normalizeDialogData(dialogData);
            return Boolean(normalized.name?.trim());
          },
        },
      },
      {
        id: 'style-settings',
        label: 'Style Settings',
        componentFactory: (p: StepComponentProps<StylerDialogData>) => <StyleSettingsStep {...p} />,
        validate: (dialogData?: unknown) => isStyleSettingsComplete(dialogData),
        capabilities: {
          canProceedToNext: (dialogData?: unknown) => isStyleSettingsComplete(dialogData),
        },
      },
      // Step 2: Spreadsheet Data Source
      {
        id: 'data-source',
        label: 'Data Source',
        componentFactory: renderDataSourceStep,
      },
      // Step 3: Spreadsheet Filtering
      {
        id: 'filtering',
        label: 'Filtering',
        componentFactory: renderFilteringStep,
      },
      // Step 4: Styler mapping (original Step2)
      {
        id: 'style-mapping',
        label: 'Style Mapping',
        componentFactory: (p: StepComponentProps<StylerDialogData>) => (
          <StylerStep5
            data={p.data}
            onChange={p.onChange}
            onValidate={(valid) => {
              p.setValid(valid);
              p.setError(valid ? null : 'Configure styling targets before continuing.');
            }}
          />
        ),
      },
      // Step 5: Preview (original Step3)
      {
        id: 'preview',
        label: 'Preview',
        componentFactory: (p: StepComponentProps<StylerDialogData>) => (
          <StylerStep6
            data={p.data}
            onChange={p.onChange}
            onValidate={(valid) => {
              p.setValid(valid);
              if (valid) {
                p.setError(null);
              }
            }}
          />
        ),
      },
    ];
  },
  getEditStepConfigs() {
    return this.getCreateStepConfigs();
  },
});
