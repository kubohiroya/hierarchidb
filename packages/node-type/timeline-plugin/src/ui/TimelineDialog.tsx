import { useMemo, useState } from 'react';
import { MultiStepDialog } from '@hierarchidb/ui-dialog';
import { BasicInfoStep, type BasicInfoValues } from './steps/BasicInfoStep';
import { FramesPreviewStep, type TimelineFrame } from './steps/FramesPreviewStep';
import { MapPreviewStep } from './steps/MapPreviewStep';
import { AnimationViewerStep } from './steps/AnimationViewerStep';

export interface TimelineDialogProps {
  mode: 'create' | 'edit';
  parentId?: string; // required in create
  nodeId?: string;   // working copy id (edit)
  open: boolean;
  onClose: () => void;
  onSuccess: (savedNodeId: string) => void;
}

export function TimelineDialog(props: TimelineDialogProps) {
  const [basic, setBasic] = useState<BasicInfoValues>({ name: 'New Timeline', description: '' });
  // TODO: integrate WorkerAPI to load descendants of the timeline node (or parent) and flatten
  const [frames] = useState<TimelineFrame[]>([
    { id: 'f1', name: 'Frame A' },
    { id: 'f2', name: 'Frame B' },
    { id: 'f3', name: 'Frame C' },
  ]);

  const steps = useMemo(() => [
    {
      id: 'basic',
      label: 'Basic Information',
      component: <BasicInfoStep values={basic} onChange={setBasic} />,
      validate: async () => (basic?.name || '').trim().length > 0,
    },
    { id: 'frames', label: 'Frames Preview', component: <FramesPreviewStep frames={frames} /> },
    { id: 'map', label: 'Map Preview', component: <MapPreviewStep frames={frames} /> },
    { id: 'final', label: 'Final Animation', component: <AnimationViewerStep frames={frames} /> },
  ], [basic, frames]);

  return (
    <MultiStepDialog
      title={props.mode === 'create' ? 'Create Timeline' : 'Edit Timeline'}
      open={props.open}
      onClose={props.onClose}
      onCancel={props.onClose}
      mode={props.mode}
      steps={steps}
      onSubmit={async () => props.onSuccess(props.nodeId || 'timeline-new')}
    />
  );
}

export async function getDialogComponent() {
  return TimelineDialog;
}
