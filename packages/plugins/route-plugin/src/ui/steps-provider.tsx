import { PluginStepRegistry, type StepComponentProps } from '@hierarchidb/runtime-ui-plugin-dialog';
import { RouteSelectionStep } from '../components/RouteSelectionStep.js';
import { RouteProcessingStep } from '../components/RouteProcessingStep.js';
import type { RouteWorkingCopy } from '../types/index.js';
import { translations as routeTranslations } from '../i18n/index.js';

const registry = PluginStepRegistry.getInstance();

type P = StepComponentProps & { data: RouteWorkingCopy };

registry.registerConfigProvider({
  nodeType: 'route',
  getCreateStepConfigs() {
    const selectionTitles = {
      en: routeTranslations.en.routeSelection.title,
      ja: routeTranslations.ja.routeSelection.title,
    } as const;
    return [
      {
        id: 'route-selection',
        label: selectionTitles.en ?? 'Route Selection',
        localization: {
          defaultTitle: selectionTitles.en ?? 'Route Selection',
          titles: selectionTitles,
        },
        componentFactory: (p: P) => (
          <RouteSelectionStep
            workingCopy={p.data}
            onUpdate={(updates: Partial<RouteWorkingCopy>) => p.onChange({ ...(p.data || {} as RouteWorkingCopy), ...updates })}
            onValidationChange={p.setValid}
          />
        ),
        validate: () => true,
      },
      {
        id: 'processing',
        label: 'Processing',
        localization: {
          defaultTitle: 'Processing',
          titles: { en: 'Processing', ja: '処理' },
        },
        componentFactory: (p: P) => (
          <RouteProcessingStep
            workingCopy={p.data}
            onUpdate={(updates: Partial<RouteWorkingCopy>) => p.onChange({ ...(p.data || {} as RouteWorkingCopy), ...updates })}
            onValidationChange={p.setValid}
          />
        ),
        validate: () => true,
      },
    ];
  },
  getEditStepConfigs(_nodeId: string, _data?: any) {
    return this.getCreateStepConfigs();
  },
});
