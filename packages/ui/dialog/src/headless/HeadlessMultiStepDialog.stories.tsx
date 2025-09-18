import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useMemo, useState } from 'react';
import {
  HeadlessMultiStepDialog,
  useHeadlessStepNavigation,
  useHeadlessDialogFrame,
  useHeadlessDirtyFlag,
  useHeadlessStepComponents,
  type StepComponentDescriptor,
  type StepComponentProps,
} from '../index.js';

interface ExampleDraft {
  name: string;
  description: string;
  members: Array<{ id: number; name: string }>;
}

const INITIAL_DRAFT: ExampleDraft = {
  name: '',
  description: '',
  members: [],
};

type ExampleStep = StepComponentDescriptor<ExampleDraft>;

const BasicsStep = ({ data, onChange }: StepComponentProps<ExampleDraft>) => (
  <div style={{ display: 'grid', gap: 8 }}>
    <label>
      <span>Name</span>
      <input
        value={data.name}
        onChange={evt => onChange({ name: evt.target.value })}
      />
    </label>
    <label>
      <span>Description</span>
      <textarea
        value={data.description}
        onChange={evt => onChange({ description: evt.target.value })}
      />
    </label>
  </div>
);

const MembersStep = ({ data, onChange }: StepComponentProps<ExampleDraft>) => (
  <div style={{ display: 'grid', gap: 8 }}>
    <button
      type="button"
      onClick={() => onChange({ members: [...data.members, { id: Date.now(), name: `Member #${data.members.length + 1}` }] })}
    >
      Add member
    </button>
    <ul>
      {data.members.map(member => (
        <li key={member.id}>{member.name}</li>
      ))}
    </ul>
  </div>
);

const ReviewStep = ({ data }: StepComponentProps<ExampleDraft>) => (
  <pre style={{ padding: 16, background: '#f6f7f9', borderRadius: 8 }}>
    {JSON.stringify(data, null, 2)}
  </pre>
);

const steps: ExampleStep[] = [
  { id: 'basics', label: 'Basics', component: BasicsStep },
  { id: 'members', label: 'Members', component: MembersStep },
  { id: 'review', label: 'Review', component: ReviewStep },
];

const meta: Meta<typeof HeadlessStory> = {
  title: 'ui/headless/HeadlessMultiStepDialog',
  component: HeadlessStory,
};

export default meta;

type Story = StoryObj<typeof HeadlessStory>;

export const Default: Story = {
  render: () => <HeadlessStory />,
};

function HeadlessStory() {
  const [draft, setDraft] = useState<ExampleDraft>(INITIAL_DRAFT);
  const [open, setOpen] = useState(true);

  const stepDescriptors = useHeadlessStepComponents(steps);
  const { dialogProps: navProps, activeStepIndex } = useHeadlessStepNavigation({ stepCount: stepDescriptors.length });
  const frame = useHeadlessDialogFrame();
  const { isDirty, markDirty, resetDirty } = useHeadlessDirtyFlag();

  const invalidMessageMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (!draft.name.trim()) {
      map['step:basics/name'] = 'Name is required';
    }
    return map;
  }, [draft.name]);

  const enabledStepIndices = useMemo(() => [0, 1, 2], []);
  const validatedStepIndices = useMemo(() => (draft.name.trim() ? [0] : []), [draft.name]);
  const committableStepIndices = useMemo(() => (draft.name.trim() ? [2] : []), [draft.name]);

  const handleStepChange = useCallback((patch: Partial<ExampleDraft>) => {
    setDraft(prev => ({ ...prev, ...patch }));
    markDirty();
  }, [markDirty]);

  const handleCommit = useCallback(() => {
    // eslint-disable-next-line no-alert
    alert(`Submitting: ${JSON.stringify(draft, null, 2)}`);
    resetDirty();
    setOpen(false);
  }, [draft, resetDirty]);

  return (
    <div style={{ padding: 24 }}>
      <button type="button" onClick={() => setOpen(true)}>Open dialog</button>

      {open && (
        <div style={{ marginTop: 24, border: '1px solid #dde1eb', borderRadius: 8 }}>
          <HeadlessMultiStepDialog<ExampleDraft>
            open
            stepComponents={stepDescriptors}
            stepData={draft}
            onStepDataChange={handleStepChange}
            enabledStepIndices={enabledStepIndices}
            validatedStepIndices={validatedStepIndices}
            committableStepIndices={committableStepIndices}
            invalidMessageMap={invalidMessageMap}
            isDirty={isDirty}
            onRequestClose={() => setOpen(false)}
            onRequestCommit={handleCommit}
            renderHeader={({ activeStepIndex: idx, displayMode, stepNavigation }) => (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #dde1eb' }}>
                <div>
                  <strong>Headless dialog</strong>
                  <div style={{ fontSize: 12, color: '#64748b' }}>step {idx + 1} / {stepDescriptors.length}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    value={displayMode}
                    onChange={evt => frame.setDisplayMode(evt.target.value as typeof displayMode)}
                  >
                    <option value="standard">Standard</option>
                    <option value="maximized">Maximized</option>
                    <option value="fullscreen">Fullscreen</option>
                  </select>
                  <button type="button" onClick={() => stepNavigation({ type: 'back' })} disabled={idx === 0}>
                    Back
                  </button>
                  <button type="button" onClick={() => stepNavigation({ type: 'next' })} disabled={idx >= stepDescriptors.length - 1}>
                    Next
                  </button>
                </div>
              </div>
            )}
            renderContent={({ activeStep }) => {
              const StepComponent = activeStep?.component;
              if (!StepComponent) return null;
              return (
                <div style={{ padding: 16 }}>
                  <StepComponent
                    stepIndex={activeStepIndex}
                    stepId={activeStep.id}
                    label={activeStep.label}
                    data={draft}
                    onChange={handleStepChange}
                    invalidMessages={invalidMessageMap}
                  />
                </div>
              );
            }}
            renderFooter={({ committableStepIndices: commitSteps, onRequestClose, onRequestCommit: requestCommit }) => (
              <div style={{ padding: '12px 16px', borderTop: '1px solid #dde1eb', display: 'flex', justifyContent: 'space-between' }}>
                <button type="button" onClick={() => onRequestClose('close')}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={requestCommit}
                  disabled={!requestCommit || !commitSteps.includes(activeStepIndex)}
                >
                  Submit
                </button>
              </div>
            )}
            {...navProps}
            {...frame.frameProps}
          />
        </div>
      )}
    </div>
  );
}
