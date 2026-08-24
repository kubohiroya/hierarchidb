import { type PluginStepProps, PluginStepRegistry, type StepData } from '@hierarchidb/plugin-base';
import { i18n } from '@hierarchidb/ui-i18n';
import type { TimelineDraft, TimelineFrame } from '~/common/entities/TimelineEntity';
import { AnimationViewerStep } from '~/ui/steps/AnimationViewerStep';
import { FramesPreviewStep } from '~/ui/steps/FramesPreviewStep';
import { MapPreviewStep } from '~/ui/steps/MapPreviewStep';

const registry = PluginStepRegistry.getInstance();

type TimelineData = StepData &
  Partial<TimelineDraft> & {
    frames?: TimelineFrame[];
  };

registry.registerConfigProvider<TimelineData>({
  nodeType: 'timeline',
  getCreateStepConfigs() {
    const t = (key: string, fallback: string) =>
      String(i18n.t(key, { ns: 'timeline-plugin', defaultValue: fallback }));
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
