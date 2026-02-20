import { PluginStepRegistry, type PluginStepProps, type StepData } from '@hierarchidb/plugin-base';
import type { TimelineDraft, TimelineFrame } from '~/common/types/index';
import { FramesPreviewStep } from '~/ui/steps/FramesPreviewStep';
import { MapPreviewStep } from '~/ui/steps/MapPreviewStep';
import { AnimationViewerStep } from '~/ui/steps/AnimationViewerStep';
import { useTranslation as getTranslation } from '~/common/i18n/index';

const registry = PluginStepRegistry.getInstance();

type TimelineData = StepData &
  Partial<TimelineDraft> & {
    frames?: TimelineFrame[];
  };

registry.registerConfigProvider<TimelineData>({
  nodeType: 'timeline',
  getCreateStepConfigs() {
    const { t } = getTranslation();
    return [
      {
        id: 'frames',
        label: t('steps.frames.label', 'Frames Preview'),
        componentFactory: (p: PluginStepProps<TimelineData>) => (
          <FramesPreviewStep frames={p.data?.frames || p.data?.draftData?.frames || []} />
        ),
      },
      {
        id: 'map',
        label: t('steps.map.label', 'Map Preview'),
        componentFactory: (p: PluginStepProps<TimelineData>) => (
          <MapPreviewStep frames={p.data?.frames || p.data?.draftData?.frames || []} />
        ),
      },
      {
        id: 'final',
        label: t('steps.final.label', 'Final Animation'),
        componentFactory: (p: PluginStepProps<TimelineData>) => (
          <AnimationViewerStep frames={p.data?.frames || p.data?.draftData?.frames || []} />
        ),
      },
    ];
  },
  getEditStepConfigs(_nodeId: string, _data?: TimelineData) {
    return this.getCreateStepConfigs();
  },
});
