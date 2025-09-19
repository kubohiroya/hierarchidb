import type { Meta, StoryObj } from '@storybook/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import {
  MultiSteps,
  type MultiStepComponentProps,
  type MultiStepDefinition,
  type MultiStepsHeaderRenderProps,
  type MultiStepsProps,
} from './MultiSteps.js';

const StepIntro = ({ label }: MultiStepComponentProps) => (
  <Typography>
    {label} — これは最初のステップです。フォームや説明など、任意のコンテンツを配置できます。
  </Typography>
);

const StepDetails = () => (
  <Stack spacing={1}>
    <Typography variant="h6">詳細入力</Typography>
    <Typography color="text.secondary">ここに詳細フォームを差し込むことを想定しています。</Typography>
  </Stack>
);

const StepReview = ({ isValidated }: MultiStepComponentProps) => (
  <Stack spacing={1}>
    <Typography variant="h6">確認</Typography>
    <Typography>{isValidated ? '検証済みです。送信できます。' : '送信前に内容を確認してください。'}</Typography>
  </Stack>
);

const baseSteps: MultiStepDefinition[] = [
  { id: 'intro', label: '概要', component: StepIntro, enabled: true, validated: true },
  { id: 'details', label: '詳細', component: StepDetails, enabled: true, validated: false },
  { id: 'review', label: '確認', component: StepReview, enabled: true, validated: false },
];

const meta: Meta<typeof MultiSteps> = {
  title: 'ui/dialog2/MultiSteps',
  component: MultiSteps,
  args: {
    steps: baseSteps,
    activeStepIndex: 0,
  },
};

export default meta;

type Story = StoryObj<typeof MultiSteps>;

export const Playground: Story = {
  render: (args: MultiStepsProps) => {
    const [activeStep, setActiveStep] = useState<number>(args.activeStepIndex);
    const [stepsState, setStepsState] = useState<MultiStepDefinition[]>(() => cloneSteps(args.steps));

    const totalSteps = stepsState.length;

    const nextStep = () => setActiveStep((current) => Math.min(current + 1, totalSteps - 1));
    const resetSteps = () => {
      setActiveStep(0);
      setStepsState(() => cloneSteps(args.steps));
    };

    const markCurrentValidated = () => {
      setStepsState((current) =>
        current.map((step, index) => (index === activeStep ? { ...step, validated: true } : step)),
      );
    };

    const toggleEnable = () => {
      setStepsState((current) =>
        current.map((step, index) =>
          index === activeStep ? { ...step, enabled: !(step.enabled ?? true) } : step,
        ),
      );
    };

    return (
      <Stack spacing={3}>
        <Box>
          <MultiSteps {...args} activeStepIndex={activeStep} steps={stepsState} />
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={resetSteps}>
            Reset
          </Button>
          <Button variant="contained" onClick={markCurrentValidated}>
            Mark Current Validated
          </Button>
          <Button variant="contained" onClick={nextStep}>
            Next Step
          </Button>
          <Button variant="outlined" onClick={toggleEnable}>
            Toggle Enabled
          </Button>
        </Stack>
      </Stack>
    );
  },
};

const PillsHeader = ({ steps, activeStepIndex }: MultiStepsHeaderRenderProps) => {
  return (
    <Stack direction="row" spacing={1}>
      {steps.map((step, index) => {
        const isActive = index === activeStepIndex;
        const isValidated = step.validated ?? false;
        return (
          <Box
            key={step.id ?? step.label}
            component="span"
            sx={{
              px: 1.5,
              py: 0.5,
              borderRadius: 999,
              bgcolor: isActive ? 'primary.main' : 'action.hover',
              color: isActive ? 'primary.contrastText' : 'text.primary',
              fontWeight: isActive ? 600 : 400,
              border: '1px solid',
              borderColor: isValidated ? 'success.light' : 'divider',
            }}
          >
            {step.label}
          </Box>
        );
      })}
    </Stack>
  );
};

export const CustomHeader: Story = {
  args: {
    steps: [
      { id: 'intro', label: '概要', component: StepIntro, enabled: true, validated: true },
      { id: 'details', label: '詳細', component: StepDetails, enabled: true, validated: true },
      { id: 'review', label: '確認', component: StepReview, enabled: true, validated: false },
    ],
    activeStepIndex: 1,
    renderHeader: (props) => <PillsHeader {...props} />,
  },
};

const cloneSteps = (steps: ReadonlyArray<MultiStepDefinition>): MultiStepDefinition[] =>
  steps.map((step) => ({ ...step }));
