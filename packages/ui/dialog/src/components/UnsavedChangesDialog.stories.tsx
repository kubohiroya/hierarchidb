import type { Meta, StoryObj } from '@storybook/react';
import { UnsavedChangesDialog } from './UnsavedChangesDialog.js';
import { Box, Chip, List, ListItem, ListItemText, Typography } from '@mui/material';

const meta = {
  title: 'ui/legacy-dialog/UnsavedChangesDialog',
  component: UnsavedChangesDialog,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: '未保存の変更を破棄する際の確認ダイアログ。保存、破棄、キャンセルのオプションを提供します。',
      },
    },
  },
  tags: ['autodocs', 'deprecated'],
  argTypes: {
    open: {
      control: 'boolean',
      description: 'ダイアログの開閉状態',
    },
    title: {
      control: 'text',
      description: 'ダイアログのタイトル',
    },
    message: {
      control: 'text',
      description: '表示するメッセージ',
    },
    showSaveDraft: {
      control: 'boolean',
      description: '下書き保存ボタンを表示するか',
    },
    onDiscard: {
      action: 'discarded',
      description: '変更を破棄する際のコールバック',
    },
    onSaveDraft: {
      action: 'saved-draft',
      description: '下書きを保存する際のコールバック',
    },
    onCancel: {
      action: 'cancelled',
      description: 'キャンセル時のコールバック',
    },
  },
} satisfies Meta<typeof UnsavedChangesDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    open: true,
    title: '未保存の変更',
    message: '変更が保存されていません。このまま移動すると、変更は失われます。',
    onDiscard: () => {
    },
    onCancel: () => {
    },
  },
};

export const WithSaveDraft: Story = {
  args: {
    open: true,
    title: '未保存の変更',
    message: '編集中の内容が保存されていません。',
    showSaveDraft: true,
    onDiscard: () => {
    },
    onSaveDraft: () => {
    },
    onCancel: () => {
    },
  },
};

export const WithDetails: Story = {
  args: {
    open: true,
    title: 'フォームの変更を破棄しますか？',
    message: '以下の項目に未保存の変更があります：',
    children: (
      <List dense>
        <ListItem>
          <ListItemText primary="タイトル" secondary="旧: ドキュメント → 新: プロジェクト計画書" />
        </ListItem>
        <ListItem>
          <ListItemText primary="説明" secondary="変更あり（200文字追加）" />
        </ListItem>
        <ListItem>
          <ListItemText primary="タグ" secondary="3個のタグが追加されました" />
        </ListItem>
      </List>
    ),
    onDiscard: () => {
    },
    onCancel: () => {
    },
  },
};

export const WithModifiedFiles: Story = {
  args: {
    open: true,
    title: 'エディターを閉じますか？',
    message: '以下のファイルに未保存の変更があります：',
    showSaveDraft: true,
    children: (
      <Box sx={{ mt: 1 }}>
        <List dense>
          {[
            { name: 'RuntimeWorkerService.ts', status: 'modified', lines: '+12, -5' },
            { name: 'components/Dialog.tsx', status: 'new', lines: '+145' },
            { name: 'styles.css', status: 'modified', lines: '+8, -3' },
          ].map((file) => (
            <ListItem key={file.name}>
              <ListItemText
                primary={file.name}
                secondary={file.lines}
              />
              <Chip
                label={file.status}
                size="small"
                color={file.status === 'new' ? 'success' : 'warning'}
              />
            </ListItem>
          ))}
        </List>
      </Box>
    ),
    onDiscard: () => {
    },
    onSaveDraft: () => {
    },
    onCancel: () => {
    },
  },
};

export const LongMessage: Story = {
  args: {
    open: true,
    title: 'プロジェクト設定の変更',
    message: 'プロジェクトの重要な設定が変更されています。これらの変更を保存せずに終了すると、すべての設定変更が失われ、デフォルト値にリセットされます。変更を確認してから続行してください。',
    showSaveDraft: true,
    onDiscard: () => {
    },
    onSaveDraft: () => {
    },
    onCancel: () => {
    },
  },
};

export const WithWarning: Story = {
  args: {
    open: true,
    title: '重要な変更の破棄',
    message: 'この操作は取り消すことができません。',
    children: (
      <Box sx={{ mt: 2, p: 2, bgcolor: 'error.light', borderRadius: 1 }}>
        <Typography variant="body2" color="error.contrastText">
          ⚠️ 警告: これらの変更には、システムの動作に影響する重要な設定が含まれています。
          変更を破棄すると、これまでの作業がすべて失われます。
        </Typography>
      </Box>
    ),
    onDiscard: () => {
    },
    onCancel: () => {
    },
  },
};

export const DataMigration: Story = {
  args: {
    open: true,
    title: 'データ移行の中断',
    message: 'データ移行プロセスが完了していません。',
    showSaveDraft: false,
    children: (
      <Box sx={{ mt: 2 }}>
        <Typography variant="body2" paragraph>
          進行状況: 1,234 / 5,000 レコード (24.7%)
        </Typography>
        <Box sx={{ width: '100%', bgcolor: 'grey.300', borderRadius: 1, overflow: 'hidden' }}>
          <Box sx={{ width: '24.7%', height: 4, bgcolor: 'primary.main' }} />
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          中断すると、移行は最初からやり直しになります。
        </Typography>
      </Box>
    ),
    onDiscard: () => {
    },
    onCancel: () => {
    },
  },
};

export const FormValidation: Story = {
  args: {
    open: true,
    title: 'フォームエラー',
    message: '入力内容にエラーがあります。修正せずに閉じますか？',
    showSaveDraft: true,
    children: (
      <List dense>
        <ListItem>
          <ListItemText
            primary="メールアドレス"
            secondary="無効な形式です"
            secondaryTypographyProps={{ color: 'error' }}
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary="パスワード"
            secondary="8文字以上で入力してください"
            secondaryTypographyProps={{ color: 'error' }}
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary="利用規約"
            secondary="同意が必要です"
            secondaryTypographyProps={{ color: 'error' }}
          />
        </ListItem>
      </List>
    ),
    onDiscard: () => {
    },
    onSaveDraft: () => {
    },
    onCancel: () => {
    },
  },
};
