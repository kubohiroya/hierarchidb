import type { Meta, StoryObj } from '@storybook/react';
import { AutoHideFullScreenDialog } from './AutoHideFullScreenDialog';
import { Button, Box, Typography, IconButton } from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';

const meta = {
  title: 'UI Dialog/AutoHideFullScreenDialog',
  component: AutoHideFullScreenDialog,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'フルスクリーンダイアログコンポーネント。自動非表示機能とコントロールバーのアニメーションを備えています。',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    title: {
      control: 'text',
      description: 'ダイアログのタイトル',
    },
    subtitle: {
      control: 'text',
      description: 'オプションのサブタイトル',
    },
    open: {
      control: 'boolean',
      description: 'ダイアログの開閉状態',
    },
    autoHide: {
      control: 'boolean',
      description: '自動非表示機能の有効/無効',
    },
    autoHideDelay: {
      control: 'number',
      description: '自動非表示までの遅延時間（ミリ秒）',
    },
    onClose: {
      action: 'closed',
      description: 'ダイアログを閉じる際のコールバック',
    },
  },
} satisfies Meta<typeof AutoHideFullScreenDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

// サンプルコンテンツコンポーネント
const SampleContent = () => (
  <Box sx={{ p: 3 }}>
    <Typography variant="h6" gutterBottom>
      ダイアログコンテンツ
    </Typography>
    <Typography paragraph>
      これはAutoHideFullScreenDialogのサンプルコンテンツです。
      マウスを動かさないと、コントロールバーが自動的に非表示になります。
    </Typography>
    <Typography paragraph>
      マウスを画面上部に移動すると、タイトルバーが表示されます。
      画面下部に移動すると、フッターアクションが表示されます。
    </Typography>
    {[...Array(10)].map((_, i) => (
      <Typography key={i} paragraph>
        ダミーテキスト {i + 1}: Lorem ipsum dolor sit amet, consectetur adipiscing elit. 
        Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 
        Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.
      </Typography>
    ))}
  </Box>
);

export const Default: Story = {
  args: {
    title: 'AutoHide FullScreen Dialog',
    open: true,
    children: <SampleContent />,
  },
};

export const WithSubtitle: Story = {
  args: {
    title: 'ドキュメントビューアー',
    subtitle: '最終更新: 2024年8月30日',
    open: true,
    children: <SampleContent />,
  },
};

export const WithIcon: Story = {
  args: {
    title: 'システム情報',
    subtitle: 'バージョン 1.0.0',
    icon: <InfoIcon />,
    open: true,
    children: <SampleContent />,
  },
};

export const WithTitleActions: Story = {
  args: {
    title: 'エディター',
    icon: <EditIcon />,
    titleActions: (
      <>
        <IconButton size="small" sx={{ color: 'inherit' }}>
          <SaveIcon />
        </IconButton>
      </>
    ),
    open: true,
    children: <SampleContent />,
  },
};

export const WithFooterActions: Story = {
  args: {
    title: '設定',
    footerActions: (
      <>
        <Button variant="outlined">キャンセル</Button>
        <Button variant="contained">保存</Button>
      </>
    ),
    open: true,
    children: <SampleContent />,
  },
};

export const AutoHideEnabled: Story = {
  args: {
    title: '自動非表示有効',
    subtitle: 'マウスを3秒間動かさないとバーが非表示になります',
    autoHide: true,
    autoHideDelay: 3000,
    open: true,
    children: <SampleContent />,
  },
};

export const AutoHideDisabled: Story = {
  args: {
    title: '自動非表示無効',
    subtitle: 'コントロールバーは常に表示されます',
    autoHide: false,
    open: true,
    children: <SampleContent />,
  },
};

export const CompleteExample: Story = {
  args: {
    title: 'プラグインレジストリ',
    subtitle: '利用可能なプラグイン一覧',
    icon: <InfoIcon />,
    titleActions: (
      <IconButton size="small" sx={{ color: 'inherit' }}>
        <EditIcon />
      </IconButton>
    ),
    footerActions: (
      <>
        <Button variant="outlined">閉じる</Button>
        <Button variant="contained" startIcon={<SaveIcon />}>
          選択したプラグインをインストール
        </Button>
      </>
    ),
    autoHide: true,
    autoHideDelay: 5000,
    open: true,
    children: <SampleContent />,
  },
};