import type { Meta, StoryObj } from '@storybook/react';
import { FullScreenDialog } from './FullScreenDialog';
import { Box, Typography, IconButton, Button } from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import EditIcon from '@mui/icons-material/Edit';
import ShareIcon from '@mui/icons-material/Share';
import DownloadIcon from '@mui/icons-material/Download';

const meta = {
  title: 'UI Dialog/FullScreenDialog',
  component: FullScreenDialog,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'シンプルなフルスクリーンダイアログコンポーネント。角丸のデザインと閉じるボタンを備えています。',
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
      description: 'オプションのサブタイトルまたは説明',
    },
    open: {
      control: 'boolean',
      description: 'ダイアログの開閉状態',
    },
    onClose: {
      action: 'closed',
      description: 'ダイアログを閉じる際のコールバック',
    },
  },
} satisfies Meta<typeof FullScreenDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

// サンプルコンテンツコンポーネント
const SampleContent = () => (
  <Box sx={{ p: 3 }}>
    <Typography variant="h6" gutterBottom>
      コンテンツエリア
    </Typography>
    <Typography paragraph>
      これはFullScreenDialogのサンプルコンテンツです。
      情報ページ、プラグインレジストリ、その他のフルスクリーンコンテンツに使用されます。
    </Typography>
    <Box sx={{ my: 3 }}>
      <Typography variant="subtitle1" gutterBottom>
        機能一覧
      </Typography>
      <ul>
        <li>角丸のデザイン</li>
        <li>閉じるボタン</li>
        <li>タイトルバーのカスタマイズ</li>
        <li>レスポンシブデザイン</li>
      </ul>
    </Box>
    {[...Array(5)].map((_, i) => (
      <Typography key={i} paragraph>
        セクション {i + 1}: Lorem ipsum dolor sit amet, consectetur adipiscing elit. 
        Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 
        Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.
      </Typography>
    ))}
  </Box>
);

export const Default: Story = {
  args: {
    title: 'FullScreen Dialog',
    open: true,
    children: <SampleContent />,
  },
};

export const WithSubtitle: Story = {
  args: {
    title: 'ヘルプドキュメント',
    subtitle: 'アプリケーションの使い方ガイド',
    open: true,
    children: <SampleContent />,
  },
};

export const WithIcon: Story = {
  args: {
    title: 'バージョン情報',
    subtitle: 'HierarchiDB v1.0.0',
    icon: <InfoIcon />,
    open: true,
    children: <SampleContent />,
  },
};

export const WithActions: Story = {
  args: {
    title: 'データエクスポート',
    subtitle: 'エクスポート設定',
    actions: (
      <>
        <IconButton size="small">
          <ShareIcon />
        </IconButton>
        <IconButton size="small">
          <DownloadIcon />
        </IconButton>
      </>
    ),
    open: true,
    children: <SampleContent />,
  },
};

export const CompleteExample: Story = {
  args: {
    title: 'プラグインレジストリ',
    subtitle: '利用可能なプラグイン: 15個',
    icon: <EditIcon />,
    actions: (
      <>
        <Button size="small" startIcon={<DownloadIcon />}>
          全てダウンロード
        </Button>
      </>
    ),
    open: true,
    children: (
      <Box sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          インストール済みプラグイン
        </Typography>
        <Box sx={{ mb: 3 }}>
          {['folder-plugin', 'shape-plugin', 'markdown-plugin'].map((plugin) => (
            <Box key={plugin} sx={{ p: 2, mb: 1, bgcolor: 'background.paper', borderRadius: 1 }}>
              <Typography variant="subtitle2">@hierarchidb/node-type-{plugin}</Typography>
              <Typography variant="body2" color="text.secondary">
                バージョン 1.0.0 • 最終更新: 2024年8月30日
              </Typography>
            </Box>
          ))}
        </Box>
        <Typography variant="h6" gutterBottom>
          利用可能なプラグイン
        </Typography>
        <Box>
          {['image-plugin', 'video-plugin', 'audio-plugin'].map((plugin) => (
            <Box key={plugin} sx={{ p: 2, mb: 1, bgcolor: 'grey.100', borderRadius: 1 }}>
              <Typography variant="subtitle2">@hierarchidb/node-type-{plugin}</Typography>
              <Typography variant="body2" color="text.secondary">
                バージョン 1.0.0 • インストール可能
              </Typography>
              <Button size="small" variant="contained" sx={{ mt: 1 }}>
                インストール
              </Button>
            </Box>
          ))}
        </Box>
      </Box>
    ),
  },
};

export const LongContent: Story = {
  args: {
    title: 'ドキュメント',
    subtitle: '詳細マニュアル',
    open: true,
    children: (
      <Box sx={{ p: 3 }}>
        {[...Array(20)].map((_, i) => (
          <Box key={i} sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              チャプター {i + 1}
            </Typography>
            <Typography paragraph>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. 
              Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 
              Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris 
              nisi ut aliquip ex ea commodo consequat.
            </Typography>
          </Box>
        ))}
      </Box>
    ),
  },
};