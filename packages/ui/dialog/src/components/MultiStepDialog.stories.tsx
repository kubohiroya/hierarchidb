import type { Meta, StoryObj } from '@storybook/react';
import { MultiStepDialog } from './MultiStepDialog';
import { MultiStepDialogEnhanced } from './MultiStepDialogEnhanced';
import {
  Box,
  TextField,
  Typography,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Chip,
  Stack,
  Alert,
} from '@mui/material';
import {
  LocationOn,
  Folder,
  Settings,
  Check,
} from '@mui/icons-material';
import React, { useState } from 'react';
import type { DialogStep } from '../types/MultiStepDialog.types';

const meta = {
  title: 'UI Dialog/MultiStepDialog',
  component: MultiStepDialog,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'マルチステップダイアログコンポーネント。プラグインベースのステップワークフローを提供します。',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    open: {
      control: 'boolean',
      description: 'ダイアログの開閉状態',
    },
    title: {
      control: 'text',
      description: 'ダイアログのタイトル',
    },
    currentStep: {
      control: 'number',
      description: '現在のステップ（0ベース）',
    },
    onStepChange: {
      action: 'step-changed',
      description: 'ステップ変更時のコールバック',
    },
    onClose: {
      action: 'closed',
      description: 'ダイアログを閉じる際のコールバック',
    },
    onSubmit: {
      action: 'submitted',
      description: 'フォーム送信時のコールバック',
    },
  },
} satisfies Meta<typeof MultiStepDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

// サンプルステップコンポーネント
const BasicInfoStep = ({ data, onDataChange }: any) => (
  <Box sx={{ p: 2 }}>
    <Typography variant="h6" gutterBottom>
      基本情報
    </Typography>
    <Stack spacing={2}>
      <TextField
        label="名前"
        fullWidth
        value={data?.name || ''}
        onChange={(e) => onDataChange({ ...data, name: e.target.value })}
        placeholder="フォルダ名を入力してください"
      />
      <TextField
        label="説明"
        fullWidth
        multiline
        rows={3}
        value={data?.description || ''}
        onChange={(e) => onDataChange({ ...data, description: e.target.value })}
        placeholder="説明を入力してください（任意）"
      />
    </Stack>
  </Box>
);

const LocationStep = ({ data, onDataChange }: any) => (
  <Box sx={{ p: 2 }}>
    <Typography variant="h6" gutterBottom>
      位置情報
    </Typography>
    <Stack spacing={2}>
      <TextField
        label="住所"
        fullWidth
        value={data?.address || ''}
        onChange={(e) => onDataChange({ ...data, address: e.target.value })}
        placeholder="住所を入力してください"
      />
      <Stack direction="row" spacing={2}>
        <TextField
          label="緯度"
          type="number"
          value={data?.latitude || ''}
          onChange={(e) => onDataChange({ ...data, latitude: parseFloat(e.target.value) })}
          placeholder="35.6762"
        />
        <TextField
          label="経度"
          type="number"
          value={data?.longitude || ''}
          onChange={(e) => onDataChange({ ...data, longitude: parseFloat(e.target.value) })}
          placeholder="139.6503"
        />
      </Stack>
    </Stack>
  </Box>
);

const PermissionsStep = ({ data, onDataChange }: any) => (
  <Box sx={{ p: 2 }}>
    <Typography variant="h6" gutterBottom>
      権限設定
    </Typography>
    <FormControl component="fieldset">
      <FormLabel component="legend">アクセス権限</FormLabel>
      <RadioGroup
        value={data?.permissions || 'private'}
        onChange={(e) => onDataChange({ ...data, permissions: e.target.value })}
      >
        <FormControlLabel value="private" control={<Radio />} label="プライベート" />
        <FormControlLabel value="shared" control={<Radio />} label="共有" />
        <FormControlLabel value="public" control={<Radio />} label="パブリック" />
      </RadioGroup>
    </FormControl>
  </Box>
);

const ReviewStep = ({ data }: any) => (
  <Box sx={{ p: 2 }}>
    <Typography variant="h6" gutterBottom>
      確認
    </Typography>
    <Stack spacing={2}>
      <Alert severity="info">
        以下の内容で作成されます。問題なければ「作成」ボタンをクリックしてください。
      </Alert>
      
      <Box>
        <Typography variant="subtitle2" color="text.secondary">
          名前
        </Typography>
        <Typography>{data?.name || '未設定'}</Typography>
      </Box>
      
      {data?.description && (
        <Box>
          <Typography variant="subtitle2" color="text.secondary">
            説明
          </Typography>
          <Typography>{data.description}</Typography>
        </Box>
      )}
      
      {data?.address && (
        <Box>
          <Typography variant="subtitle2" color="text.secondary">
            住所
          </Typography>
          <Typography>{data.address}</Typography>
        </Box>
      )}
      
      {data?.latitude && data?.longitude && (
        <Box>
          <Typography variant="subtitle2" color="text.secondary">
            座標
          </Typography>
          <Typography>{data.latitude}, {data.longitude}</Typography>
        </Box>
      )}
      
      <Box>
        <Typography variant="subtitle2" color="text.secondary">
          権限
        </Typography>
        <Chip 
          label={data?.permissions === 'private' ? 'プライベート' : 
                data?.permissions === 'shared' ? '共有' : 'パブリック'} 
          size="small" 
        />
      </Box>
    </Stack>
  </Box>
);

// フォルダー作成のステップ定義
const folderSteps: DialogStep[] = [
  {
    id: 'basic',
    label: '基本情報',
    optional: false,
    component: <BasicInfoStep />,
    icon: <Folder />,
  },
  {
    id: 'permissions',
    label: '権限設定',
    optional: false,
    component: <PermissionsStep />,
    icon: <Settings />,
  },
  {
    id: 'review',
    label: '確認',
    optional: false,
    component: <ReviewStep />,
    icon: <Check />,
  },
];

// ロケーション作成のステップ定義
const locationSteps: DialogStep[] = [
  {
    id: 'basic',
    label: '基本情報',
    optional: false,
    component: <BasicInfoStep />,
    icon: <Folder />,
  },
  {
    id: 'location',
    label: '位置情報',
    optional: false,
    component: <LocationStep />,
    icon: <LocationOn />,
  },
  {
    id: 'permissions',
    label: '権限設定',
    optional: true,
    component: <PermissionsStep />,
    icon: <Settings />,
  },
  {
    id: 'review',
    label: '確認',
    optional: false,
    component: <ReviewStep />,
    icon: <Check />,
  },
];

export const BasicFolderCreation: Story = {
  args: {
    open: true,
    title: 'フォルダーを作成',
    steps: folderSteps,
    currentStep: 0,
    maxWidth: 'sm',
    fullWidth: true,
  },
  render: (args) => {
    const [currentStep, setCurrentStep] = useState(args.currentStep || 0);
    const [data, setData] = useState({});

    const stepsWithData = folderSteps.map(step => ({
      ...step,
      component: React.cloneElement(step.component as React.ReactElement, {
        data,
        onDataChange: setData,
      }),
    }));

    return (
      <MultiStepDialog
        {...args}
        steps={stepsWithData}
        currentStep={currentStep}
        onStepChange={setCurrentStep}
        data={data}
      />
    );
  },
};

export const LocationCreation: Story = {
  args: {
    open: true,
    title: 'ロケーションを作成',
    steps: locationSteps,
    currentStep: 0,
    maxWidth: 'md',
    fullWidth: true,
  },
  render: (args) => {
    const [currentStep, setCurrentStep] = useState(args.currentStep || 0);
    const [data, setData] = useState({});

    const stepsWithData = locationSteps.map(step => ({
      ...step,
      component: React.cloneElement(step.component as React.ReactElement, {
        data,
        onDataChange: setData,
      }),
    }));

    return (
      <MultiStepDialog
        {...args}
        steps={stepsWithData}
        currentStep={currentStep}
        onStepChange={setCurrentStep}
        data={data}
      />
    );
  },
};

export const NonLinearNavigation: Story = {
  args: {
    open: true,
    title: 'ノンリニアナビゲーション',
    steps: folderSteps,
    currentStep: 0,
    nonLinear: true,
    maxWidth: 'sm',
    fullWidth: true,
  },
  render: (args) => {
    const [currentStep, setCurrentStep] = useState(args.currentStep || 0);
    const [data, setData] = useState({ name: '事前入力済み' }); // 事前データで全ステップ移動可能

    const stepsWithData = folderSteps.map(step => ({
      ...step,
      component: React.cloneElement(step.component as React.ReactElement, {
        data,
        onDataChange: setData,
      }),
    }));

    return (
      <MultiStepDialog
        {...args}
        steps={stepsWithData}
        currentStep={currentStep}
        onStepChange={setCurrentStep}
        data={data}
      />
    );
  },
};

// Enhanced版のストーリー
export const EnhancedDialog: Story = {
  render: () => {
    const [open, setOpen] = useState(true);
    const [currentStep, setCurrentStep] = useState(0);
    const [data, setData] = useState({});

    const stepsWithData = folderSteps.map(step => ({
      ...step,
      component: React.cloneElement(step.component as React.ReactElement, {
        data,
        onDataChange: setData,
      }),
    }));

    return (
      <MultiStepDialogEnhanced
        open={open}
        title="拡張マルチステップダイアログ"
        steps={stepsWithData}
        currentStep={currentStep}
        onStepChange={setCurrentStep}
        onClose={() => setOpen(false)}
        onSubmit={async (finalData) => {
          console.log('提出されたデータ:', finalData);
          setOpen(false);
        }}
        maxWidth="md"
        fullWidth
        enableFullscreen
        supportsDraft
        isBatchDialog
        data={data}
      />
    );
  },
};

export const FullscreenMode: Story = {
  render: () => {
    const [open, setOpen] = useState(true);
    const [currentStep, setCurrentStep] = useState(0);
    const [data, setData] = useState({});

    const stepsWithData = locationSteps.map(step => ({
      ...step,
      component: React.cloneElement(step.component as React.ReactElement, {
        data,
        onDataChange: setData,
      }),
    }));

    return (
      <MultiStepDialogEnhanced
        open={open}
        title="フルスクリーンモード"
        steps={stepsWithData}
        currentStep={currentStep}
        onStepChange={setCurrentStep}
        onClose={() => setOpen(false)}
        onSubmit={async (finalData) => {
          console.log('提出されたデータ:', finalData);
          setOpen(false);
        }}
        fullScreen
        enableFullscreen
        autoHideHeader
        autoHideFooter
        data={data}
      />
    );
  },
};

export const BatchProcessingMode: Story = {
  render: () => {
    const [open, setOpen] = useState(true);
    const [currentStep, setCurrentStep] = useState(0);
    const [data, setData] = useState({ name: 'バッチ処理用データ' });

    const stepsWithData = folderSteps.map(step => ({
      ...step,
      component: React.cloneElement(step.component as React.ReactElement, {
        data,
        onDataChange: setData,
      }),
    }));

    return (
      <MultiStepDialogEnhanced
        open={open}
        title="バッチ処理ダイアログ"
        steps={stepsWithData}
        currentStep={currentStep}
        onStepChange={setCurrentStep}
        onClose={() => setOpen(false)}
        onSubmit={async (finalData) => {
          console.log('バッチ処理データ:', finalData);
          setOpen(false);
        }}
        isBatchDialog
        nonLinear
        data={data}
        batchText="バッチ処理開始"
      />
    );
  },
};