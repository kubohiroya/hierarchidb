import { PluginStepRegistry, type StepComponentProps } from '@hierarchidb/ui-plugin-dialog';
import { FramesPreviewStep } from '../steps/FramesPreviewStep.js';
import { MapPreviewStep } from '../steps/MapPreviewStep.js';
import { AnimationViewerStep } from '../steps/AnimationViewerStep.js';

const registry = PluginStepRegistry.getInstance();

type TimelineFrameConfig = {
  id: string;
  name: string;
  viewState?: {
    longitude: number;
    latitude: number;
    zoom?: number;
    bearing?: number;
    pitch?: number;
  };
};

type TimelineData = { basic: { name: string; description?: string }; frames: TimelineFrameConfig[] };
type P = StepComponentProps & { data: TimelineData };

registry.registerConfigProvider({
  nodeType: 'timeline',
  getCreateStepConfigs() {
    return [
      {
        id: 'frames',
        label: 'Frames Preview',
        localization: {
          defaultTitle: 'Frames Preview',
          titles: { en: 'Frames Preview', ja: 'フレームプレビュー' },
        },
        componentFactory: (p: P) => (
          <FramesPreviewStep frames={p.data?.frames || []} />
        ),
      },
      {
        id: 'map',
        label: 'Map Preview',
        localization: {
          defaultTitle: 'Map Preview',
          titles: { en: 'Map Preview', ja: '地図プレビュー' },
        },
        componentFactory: (p: P) => (
          <MapPreviewStep frames={p.data?.frames || []} />
        ),
      },
      {
        id: 'final',
        label: 'Final Animation',
        localization: {
          defaultTitle: 'Final Animation',
          titles: { en: 'Final Animation', ja: 'アニメーション確認' },
        },
        componentFactory: (p: P) => (
          <AnimationViewerStep frames={p.data?.frames || []} />
        ),
      },
    ];
  },
  getEditStepConfigs(_nodeId: string) { return this.getCreateStepConfigs(); },
});
