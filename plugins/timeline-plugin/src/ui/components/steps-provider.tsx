import { PluginStepRegistry, type StepComponentProps, type StepData } from '@hierarchidb/plugin-base';
import type { TimelineDraft, TimelineFrame } from '../../common/types/index.js';
import { FramesPreviewStep } from '../steps/FramesPreviewStep.js';
import { MapPreviewStep } from '../steps/MapPreviewStep.js';
import { AnimationViewerStep } from '../steps/AnimationViewerStep.js';
import { useTranslation as getTranslation } from '../../common/i18n/index.js';

const registry = PluginStepRegistry.getInstance();

type TimelineData = StepData &
  Pick<TimelineDraft, 'treeNodeId' | 'draftMetadata'> &
  Partial<Pick<TimelineDraft, 'draftData'>> & {
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
        componentFactory: (p: StepComponentProps<TimelineData>) => (
          <FramesPreviewStep frames={p.data?.frames || p.data?.draftData?.frames || []} />
        ),
      },
      {
        id: 'map',
        label: t('steps.map.label', 'Map Preview'),
        componentFactory: (p: StepComponentProps<TimelineData>) => (
          <MapPreviewStep frames={p.data?.frames || p.data?.draftData?.frames || []} />
        ),
      },
      {
        id: 'final',
        label: t('steps.final.label', 'Final Animation'),
        componentFactory: (p: StepComponentProps<TimelineData>) => (
          <AnimationViewerStep frames={p.data?.frames || p.data?.draftData?.frames || []} />
        ),
      },
    ];
  },
  getEditStepConfigs(_nodeId: string, _data?: TimelineData) {
    return this.getCreateStepConfigs();
  },
});
