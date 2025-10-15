import { PluginStepRegistry, type StepComponentProps } from '@hierarchidb/runtime-ui-plugin-dialog';
import { LocationSelectionStep } from '../common/components/steps/LocationSelectionStep.js';
import type { LocationWorkingCopy } from '../common/types/index.ts';
import { translations as locationTranslations } from '../common/i18n/index.ts';

const registry = PluginStepRegistry.getInstance();

type P = StepComponentProps & { data: LocationWorkingCopy };

registry.registerConfigProvider({
  nodeType: 'location',
  getCreateStepConfigs() {
    const selectionTitles = {
      en: locationTranslations.en.selection.title,
      ja: locationTranslations.ja.selection.title,
    } as const;
    return [
      {
        id: 'selection',
        label: selectionTitles.en ?? 'Location Selection',
        localization: {
          defaultTitle: selectionTitles.en ?? 'Location Selection',
          titles: selectionTitles,
        },
        validate: () => true,
        componentFactory: (p: P) => (
          <LocationSelectionStep
            workingCopy={p.data}
            onUpdate={async (updates) => { p.onChange({ ...(p.data || {} as LocationWorkingCopy), ...updates }); }}
          />
        ),
      },
    ];
  },
  getEditStepConfigs(_nodeId: string) { return this.getCreateStepConfigs(); },
});
