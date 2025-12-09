import { PluginStepRegistry, type StepComponentProps, type StepData } from '@hierarchidb/plugin-base';
import type { TimelineDraft, TimelineFrame } from '../../common/types/index.js';
import { FramesPreviewStep } from '../steps/FramesPreviewStep.js';
import { MapPreviewStep } from '../steps/MapPreviewStep.js';
import { AnimationViewerStep } from '../steps/AnimationViewerStep.js';
import { useTranslation as getTranslation } from '../../common/i18n/index.js';
import { BasicInfoStep, type BasicInfoData } from '@hierarchidb/ui-plugin-basic-info';
import type { TreeNodeMetadata, NodeId } from '@hierarchidb/common-types';

const registry = PluginStepRegistry.getInstance();

type TimelineData = StepData &
  Pick<TimelineDraft, 'treeNodeId' | 'draftMetadata'> &
  Partial<Pick<TimelineDraft, 'draftData'>> & {
    frames?: TimelineFrame[];
  };

const ensureDraft = (data?: TimelineData): TimelineData => ({
  treeNodeId: (data?.treeNodeId ?? '') as NodeId,
  draftMetadata: (data?.draftMetadata ?? { name: '', description: '', tags: [] }) as TreeNodeMetadata,
  draftData: data?.draftData ?? {},
  frames: data?.frames ?? data?.draftData?.frames,
});

registry.registerConfigProvider<TimelineData>({
  nodeType: 'timeline',
  getCreateStepConfigs() {
    const { t } = getTranslation();
    return [
      {
        id: 'basic-info',
        label: t('steps.basicInfo.label', 'Basic Info'),
        componentFactory: (p: StepComponentProps<TimelineData>) => {
          const draft = ensureDraft(p.data);
          const meta = draft.draftMetadata ?? { name: '', description: '', tags: [] };
          return (
            <BasicInfoStep
              name={meta.name ?? ''}
              description={meta.description ?? ''}
              tags={meta.tags ?? []}
              mode={p.mode}
              onChange={({ name, description, tags }: BasicInfoData) =>
                p.onChange({
                  ...draft,
                  draftMetadata: { ...meta, name, description, tags: tags ?? [] },
                })
              }
              validate={({ name }) => (name.trim().length ? null : 'Name is required')}
            />
          );
        },
        validate: (data?: TimelineData) => Boolean(data?.draftMetadata?.name?.trim()),
      },
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
