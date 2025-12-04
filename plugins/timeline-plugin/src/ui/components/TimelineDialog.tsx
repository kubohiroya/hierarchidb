import { useMemo, useRef } from 'react';
import { HeadlessMultiStepDialog, type HeadlessMultiStepDialogProps } from '@hierarchidb/ui-dialog';
import { useTreeNodeDialog } from '@hierarchidb/plugin-ui-sdk';
import type { NodeId, TreeNodeMetadata } from '@hierarchidb/common-types';
import type { TimelineEntity, TimelineFrame } from '../../common/types/index.js';
import { BasicInfoStep, type BasicInfoValues } from '../steps/BasicInfoStep.js';
import { FramesPreviewStep } from '../steps/FramesPreviewStep.js';
import { MapPreviewStep } from '../steps/MapPreviewStep.js';
import { AnimationViewerStep } from '../steps/AnimationViewerStep.js';

export interface TimelineDialogProps {
  mode: 'create' | 'edit';
  parentId?: string;
  nodeId?: string;
  open: boolean;
  onClose: () => void;
  onSuccess: (savedNodeId: string) => void;
}

type TimelineDialogData = Partial<TimelineEntity>;

export function TimelineDialog(props: TimelineDialogProps) {
  const latestNodeIdRef = useRef<NodeId | undefined>(props.nodeId as NodeId | undefined);

  const {
    frameStyle,
    headlessProps,
    treeNodeUpdater,
  } = useTreeNodeDialog<TimelineDialogData>({
    open: props.open,
    mode: props.mode,
    nodeType: 'timeline',
    nodeId: props.nodeId as NodeId | undefined,
    parentId: props.parentId as NodeId | undefined,
    onClose: props.onClose,
    initialDraftData: { frames: [] },
    initialDraftMetadata: { name: 'New Timeline', description: '', tags: [] },
    onSave: async (_meta: TreeNodeMetadata, savedId?: NodeId) => {
      const effectiveId = savedId ?? latestNodeIdRef.current;
      if (effectiveId) {
        props.onSuccess(effectiveId as string);
      }
    },
    buildSteps: ({ data, metadata, persistBasicInfo }) => {
      const frames = (data.frames ?? []) as TimelineFrame[];
      const basic: BasicInfoValues = {
        name: metadata?.name ?? 'New Timeline',
        description: metadata?.description ?? '',
      };

      const handleBasicInfoChange = (next: BasicInfoValues) => {
        persistBasicInfo({
          name: next.name,
          description: next.description ?? '',
          tags: metadata?.tags ?? [],
        });
      };

      return [
        {
          id: 'basic',
          label: 'Basic Information',
          component: (
            <BasicInfoStep
              values={basic}
              onChange={handleBasicInfoChange}
            />
          ),
          validate: () => Boolean(basic.name?.trim()),
        },
        { id: 'frames', label: 'Frames Preview', component: <FramesPreviewStep frames={frames} /> },
        { id: 'map', label: 'Map Preview', component: <MapPreviewStep frames={frames} /> },
        { id: 'final', label: 'Final Animation', component: <AnimationViewerStep frames={frames} /> },
      ];
    },
  });

  latestNodeIdRef.current = treeNodeUpdater?.treeNodeId ?? latestNodeIdRef.current;

  const dialogProps = useMemo<HeadlessMultiStepDialogProps<TimelineDialogData>>(
    () => ({
      ...headlessProps,
      renderHeader: (propsHeader) => (
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: '1px solid #dde1eb',
          }}
        >
          <div>
            <strong>{props.mode === 'create' ? 'Create Timeline' : 'Edit Timeline'}</strong>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              Step {propsHeader.activeStepIndex + 1} / {headlessProps.stepComponents.length}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => headlessProps.onStepNavigate?.({ type: 'back' })}
              disabled={propsHeader.activeStepIndex === 0}
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => headlessProps.onStepNavigate?.({ type: 'next' })}
              disabled={propsHeader.activeStepIndex >= headlessProps.stepComponents.length - 1}
            >
              Next
            </button>
          </div>
        </header>
      ),
      renderContent: (propsContent) => (
        <div style={{ padding: 16 }}>
          {(() => {
            const active = headlessProps.stepComponents[propsContent.activeStepIndex];
            if (!active?.component) return null;
            const StepComponent = active.component;
            return (
              <StepComponent
                stepIndex={propsContent.activeStepIndex}
                stepId={active.id}
                label={active.label}
                data={headlessProps.stepData}
                onChange={() => {}}
                invalidMessages={headlessProps.invalidMessageMap ?? {}}
              />
            );
          })()}
        </div>
      ),
      renderFooter: (propsFooter) => (
        <footer
          style={{
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            borderTop: '1px solid #dde1eb',
          }}
        >
          <button type="button" onClick={() => propsFooter.onRequestClose?.('close')}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => propsFooter.onRequestCommit?.()}
            disabled={
              !headlessProps.validatedStepIndices ||
              headlessProps.validatedStepIndices.length < headlessProps.stepComponents.length
            }
          >
            Save
          </button>
        </footer>
      ),
    }),
    [headlessProps, props.mode]
  );

  return (
    <div style={frameStyle} role="dialog" aria-modal={props.open}>
      <HeadlessMultiStepDialog {...dialogProps} />
    </div>
  );
}

export async function getDialogComponent() {
  return TimelineDialog;
}
