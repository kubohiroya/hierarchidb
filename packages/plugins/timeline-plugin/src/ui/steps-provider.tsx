import { PluginStepRegistry, type StepComponentProps } from '@hierarchidb/runtime-ui-plugin-dialog';
import { FramesPreviewStep } from './steps/FramesPreviewStep.js';
import { MapPreviewStep } from './steps/MapPreviewStep.js';
import { AnimationViewerStep } from './steps/AnimationViewerStep.js';

const registry = PluginStepRegistry.getInstance();

type TimelineData = { basic: { name: string; description?: string }; frames: { id: string; name: string }[] };
type P = StepComponentProps & { data: TimelineData };

registry.registerConfigProvider({
  nodeType: 'timeline',
  getCreateStepConfigs() {
    return [
      {
        id: 'frames',
        label: 'Frames Preview',
        componentFactory: (p: P) => (
          <FramesPreviewStep frames={p.data?.frames || []} />
        ),
      },
      {
        id: 'map',
        label: 'Map Preview',
        componentFactory: (p: P) => (
          <MapPreviewStep frames={p.data?.frames || []} />
        ),
      },
      {
        id: 'final',
        label: 'Final Animation',
        componentFactory: (p: P) => (
          <AnimationViewerStep frames={p.data?.frames || []} />
        ),
      },
    ];
  },
  getEditStepConfigs(_nodeId: string) { return this.getCreateStepConfigs(); },
});
