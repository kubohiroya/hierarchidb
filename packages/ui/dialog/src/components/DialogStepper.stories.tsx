import type { Meta, StoryObj } from '@storybook/react';
import { DialogStepper } from './DialogStepper';
import { Box } from '@mui/material';
import { AccountCircle, Check, Folder, Info, LocationOn, Payment, Security, Settings } from '@mui/icons-material';
import { useState } from 'react';
import type { DialogStep } from '../types/MultiStepDialog.types';

const meta = {
  title: 'UI Dialog/DialogStepper',
  component: DialogStepper,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'ダイアログ用ステッパーコンポーネント。多段階フォームのナビゲーションを提供します。',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    activeStep: {
      control: 'number',
      description: '現在アクティブなステップ（0ベース）',
    },
    nonLinear: {
      control: 'boolean',
      description: 'ノンリニアナビゲーションの有効/無効',
    },
    alternativeLabel: {
      control: 'boolean',
      description: 'アイコン下にラベルを表示するかどうか',
    },
    onStepClick: {
      action: 'step-clicked',
      description: 'ステップクリック時のコールバック',
    },
  },
} satisfies Meta<typeof DialogStepper>;

export default meta;
type Story = StoryObj<typeof meta>;

const basicSteps: DialogStep[] = [
  {
    id: 'info',
    label: '基本情報',
    optional: false,
    component: <div />,
    icon: <Info />,
  },
  {
    id: 'details',
    label: '詳細設定',
    optional: false,
    component: <div />,
    icon: <Settings />,
  },
  {
    id: 'review',
    label: '確認',
    optional: false,
    component: <div />,
    icon: <Check />,
  },
];

const folderSteps: DialogStep[] = [
  {
    id: 'basic',
    label: '基本情報',
    optional: false,
    component: <div />,
    icon: <Folder />,
  },
  {
    id: 'location',
    label: '配置先',
    optional: false,
    component: <div />,
    icon: <LocationOn />,
  },
  {
    id: 'permissions',
    label: '権限設定',
    optional: true,
    component: <div />,
    icon: <Security />,
  },
  {
    id: 'review',
    label: '確認',
    optional: false,
    component: <div />,
    icon: <Check />,
  },
];

const userRegistrationSteps: DialogStep[] = [
  {
    id: 'account',
    label: 'アカウント情報',
    optional: false,
    component: <div />,
    icon: <AccountCircle />,
  },
  {
    id: 'profile',
    label: 'プロフィール',
    optional: false,
    component: <div />,
    icon: <Info />,
  },
  {
    id: 'payment',
    label: '支払い情報',
    optional: true,
    component: <div />,
    icon: <Payment />,
  },
  {
    id: 'security',
    label: 'セキュリティ',
    optional: false,
    component: <div />,
    icon: <Security />,
  },
  {
    id: 'review',
    label: '確認',
    optional: false,
    component: <div />,
    icon: <Check />,
  },
];

export const Basic: Story = {
  args: {
    steps: basicSteps,
    activeStep: 0,
    completedSteps: new Set(),
  },
};

export const WithProgress: Story = {
  args: {
    steps: basicSteps,
    activeStep: 1,
    completedSteps: new Set([0]),
  },
};

export const AllCompleted: Story = {
  args: {
    steps: basicSteps,
    activeStep: 2,
    completedSteps: new Set([0, 1, 2]),
  },
};

export const NonLinearNavigation: Story = {
  args: {
    steps: folderSteps,
    activeStep: 2,
    completedSteps: new Set([0]),
    nonLinear: true,
  },
  render: (args) => {
    const [activeStep, setActiveStep] = useState(args.activeStep || 0);
    const [completedSteps, setCompletedSteps] = useState(args.completedSteps || new Set());

    const handleStepClick = async (stepIndex: number) => {
      setActiveStep(stepIndex);
      setCompletedSteps((prev) => new Set([...prev, activeStep]));
    };

    return (
      <DialogStepper
        {...args}
        activeStep={activeStep}
        completedSteps={completedSteps}
        onStepClick={handleStepClick}
      />
    );
  },
};

export const AlternativeLabel: Story = {
  args: {
    steps: folderSteps,
    activeStep: 1,
    completedSteps: new Set([0]),
    alternativeLabel: true,
  },
};

export const LongStepNames: Story = {
  args: {
    steps: userRegistrationSteps,
    activeStep: 2,
    completedSteps: new Set([0, 1]),
    alternativeLabel: true,
  },
};

export const Interactive: Story = {
  args: {
    steps: folderSteps,
    activeStep: 0,
    completedSteps: new Set<number>(),
    nonLinear: true,
  },
  render: () => {
    const [activeStep, setActiveStep] = useState(0);
    const [completedSteps, setCompletedSteps] = useState(new Set<number>());

    const handleStepClick = async (stepIndex: number) => {
      if (activeStep < stepIndex) {
        setCompletedSteps((prev) => {
          const newSet = new Set(prev);
          for (let i = 0; i < stepIndex; i++) {
            newSet.add(i);
          }
          return newSet;
        });
      }
      setActiveStep(stepIndex);
    };

    return (
      <Box sx={{ p: 3, maxWidth: 600 }}>
        <DialogStepper
          steps={folderSteps}
          activeStep={activeStep}
          completedSteps={completedSteps}
          nonLinear={true}
          onStepClick={handleStepClick}
        />
        <Box sx={{ mt: 3, display: 'flex', gap: 1 }}>
          <button
            onClick={() => {
              if (activeStep > 0) {
                setActiveStep(activeStep - 1);
              }
            }}
            disabled={activeStep === 0}
          >
            戻る
          </button>
          <button
            onClick={() => {
              if (activeStep < folderSteps.length - 1) {
                setCompletedSteps((prev) => new Set([...prev, activeStep]));
                setActiveStep(activeStep + 1);
              }
            }}
            disabled={activeStep === folderSteps.length - 1}
          >
            次へ
          </button>
        </Box>
      </Box>
    );
  },
};

export const CompactMode: Story = {
  args: {
    steps: basicSteps,
    activeStep: 1,
    completedSteps: new Set([0]),
    alternativeLabel: false,
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};

export const WithOptionalSteps: Story = {
  args: {
    steps: folderSteps, //  optional: true
    activeStep: 1,
    completedSteps: new Set([0]),
    alternativeLabel: true,
  },
};

export const ErrorState: Story = {
  args: {
    steps: folderSteps,
    activeStep: 1,
    completedSteps: new Set([0]),
  },
  render: () => {
    const [activeStep, setActiveStep] = useState(1);
    const [completedSteps] = useState(new Set([0]));
    useState(new Set([1]));
    return (
      <DialogStepper
        steps={basicSteps}
        activeStep={activeStep}
        completedSteps={completedSteps}
        onStepClick={setActiveStep}
        currentData={{ hasErrors: true }} />
    );
  },
};
