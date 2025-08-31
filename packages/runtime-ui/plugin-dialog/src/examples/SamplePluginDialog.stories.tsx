import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Provider as JotaiProvider } from 'jotai';
import { MultiStepDialogEnhanced } from '@hierarchidb/ui-dialog';
import {
  Box,
  TextField,
  Typography,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Stack,
  Alert,
  Switch,
  Chip,
  Autocomplete,
} from '@mui/material';
import { Folder, Settings, Check, Tag } from '@mui/icons-material';
import type { DialogStep } from '@hierarchidb/ui-dialog';

const meta = {
  title: 'Plugin Dialog/Sample Plugin Dialogs',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'プラグインダイアログシステムのサンプル実装。実際のプラグインがどのように多段階ダイアログを提供するかを示します。',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta;

export default meta;

// フォルダープラグインのステップコンポーネント
const FolderBasicInfoStep = ({ data, onDataChange }: any) => (
  <Box sx={{ p: 3 }}>
    <Typography variant="h6" gutterBottom>
      フォルダー基本情報
    </Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
      新しいフォルダーの基本的な情報を入力してください。
    </Typography>

    <Stack spacing={3}>
      <TextField
        label="フォルダー名"
        fullWidth
        required
        value={data?.name || ''}
        onChange={(e) => onDataChange({ ...data, name: e.target.value })}
        placeholder="例: プロジェクト資料"
        helperText="フォルダー名は必須です"
        error={!data?.name}
      />

      <TextField
        label="説明"
        fullWidth
        multiline
        rows={3}
        value={data?.description || ''}
        onChange={(e) => onDataChange({ ...data, description: e.target.value })}
        placeholder="このフォルダーの用途や内容について説明してください（任意）"
      />

      <FormControl>
        <FormLabel component="legend">フォルダータイプ</FormLabel>
        <RadioGroup
          value={data?.folderType || 'standard'}
          onChange={(e) => onDataChange({ ...data, folderType: e.target.value })}
        >
          <FormControlLabel value="standard" control={<Radio />} label="標準フォルダー" />
          <FormControlLabel value="project" control={<Radio />} label="プロジェクトフォルダー" />
          <FormControlLabel value="archive" control={<Radio />} label="アーカイブフォルダー" />
        </RadioGroup>
      </FormControl>
    </Stack>
  </Box>
);

const FolderPermissionsStep = ({ data, onDataChange }: any) => (
  <Box sx={{ p: 3 }}>
    <Typography variant="h6" gutterBottom>
      権限設定
    </Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
      フォルダーのアクセス権限とセキュリティ設定を行います。
    </Typography>

    <Stack spacing={3}>
      <FormControl>
        <FormLabel component="legend">アクセス権限</FormLabel>
        <RadioGroup
          value={data?.permissions || 'private'}
          onChange={(e) => onDataChange({ ...data, permissions: e.target.value })}
        >
          <FormControlLabel
            value="private"
            control={<Radio />}
            label="プライベート - 作成者のみアクセス可能"
          />
          <FormControlLabel
            value="shared"
            control={<Radio />}
            label="共有 - 指定したユーザーとアクセス可能"
          />
          <FormControlLabel
            value="public"
            control={<Radio />}
            label="パブリック - 全ユーザーがアクセス可能"
          />
        </RadioGroup>
      </FormControl>

      {data?.permissions === 'shared' && (
        <Autocomplete
          multiple
          options={['user1@example.com', 'user2@example.com', 'team@example.com']}
          value={data?.sharedUsers || []}
          onChange={(_, newValue) => onDataChange({ ...data, sharedUsers: newValue })}
          renderInput={(params) => (
            <TextField {...params} label="共有ユーザー" placeholder="ユーザーを選択してください" />
          )}
        />
      )}

      <Box>
        <FormControlLabel
          control={
            <Switch
              checked={data?.enableVersioning || false}
              onChange={(e) => onDataChange({ ...data, enableVersioning: e.target.checked })}
            />
          }
          label="バージョン管理を有効にする"
        />
        <Typography variant="caption" display="block" color="text.secondary">
          ファイルの履歴を保持し、以前のバージョンに戻すことができます
        </Typography>
      </Box>

      <Box>
        <FormControlLabel
          control={
            <Switch
              checked={data?.enableEncryption || false}
              onChange={(e) => onDataChange({ ...data, enableEncryption: e.target.checked })}
            />
          }
          label="暗号化を有効にする"
        />
        <Typography variant="caption" display="block" color="text.secondary">
          フォルダー内のファイルを暗号化して保存します
        </Typography>
      </Box>
    </Stack>
  </Box>
);

const FolderTemplatesStep = ({ data, onDataChange }: any) => (
  <Box sx={{ p: 3 }}>
    <Typography variant="h6" gutterBottom>
      テンプレートとタグ
    </Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
      フォルダーテンプレートとタグを設定します。これらは任意の設定です。
    </Typography>

    <Stack spacing={3}>
      <Autocomplete
        multiple
        options={['ドキュメント', 'プレゼン', 'スプレッドシート', '画像', '動画']}
        value={data?.templates || []}
        onChange={(_, newValue) => onDataChange({ ...data, templates: newValue })}
        renderInput={(params) => (
          <TextField
            {...params}
            label="フォルダーテンプレート"
            placeholder="使用するテンプレートを選択"
          />
        )}
        renderTags={(value, getTagProps) =>
          value.map((option, index) => (
            <Chip variant="outlined" label={option} {...getTagProps({ index })} key={option} />
          ))
        }
      />

      <Autocomplete
        multiple
        freeSolo
        options={['重要', 'プロジェクト', '進行中', '完了', '保留']}
        value={data?.tags || []}
        onChange={(_, newValue) => onDataChange({ ...data, tags: newValue })}
        renderInput={(params) => (
          <TextField {...params} label="タグ" placeholder="タグを追加（Enterで確定）" />
        )}
        renderTags={(value, getTagProps) =>
          value.map((option, index) => (
            <Chip
              label={option}
              {...getTagProps({ index })}
              key={option}
              icon={<Tag />}
              size="small"
            />
          ))
        }
      />
    </Stack>
  </Box>
);

const FolderReviewStep = ({ data }: any) => (
  <Box sx={{ p: 3 }}>
    <Typography variant="h6" gutterBottom>
      設定内容の確認
    </Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
      以下の内容でフォルダーを作成します。問題なければ「作成」ボタンをクリックしてください。
    </Typography>

    <Alert severity="info" sx={{ mb: 3 }}>
      作成後も設定を変更することができます。
    </Alert>

    <Stack spacing={2}>
      <Box>
        <Typography variant="subtitle2" color="text.secondary">
          フォルダー名
        </Typography>
        <Typography variant="body1" fontWeight="medium">
          {data?.name || '未設定'}
        </Typography>
      </Box>

      {data?.description && (
        <Box>
          <Typography variant="subtitle2" color="text.secondary">
            説明
          </Typography>
          <Typography variant="body2">{data.description}</Typography>
        </Box>
      )}

      <Box>
        <Typography variant="subtitle2" color="text.secondary">
          フォルダータイプ
        </Typography>
        <Chip
          label={
            data?.folderType === 'standard'
              ? '標準フォルダー'
              : data?.folderType === 'project'
                ? 'プロジェクトフォルダー'
                : 'アーカイブフォルダー'
          }
          size="small"
          variant="outlined"
        />
      </Box>

      <Box>
        <Typography variant="subtitle2" color="text.secondary">
          アクセス権限
        </Typography>
        <Chip
          label={
            data?.permissions === 'private'
              ? 'プライベート'
              : data?.permissions === 'shared'
                ? '共有'
                : 'パブリック'
          }
          size="small"
          color={
            data?.permissions === 'private'
              ? 'default'
              : data?.permissions === 'shared'
                ? 'primary'
                : 'secondary'
          }
        />
      </Box>

      {data?.sharedUsers && data.sharedUsers.length > 0 && (
        <Box>
          <Typography variant="subtitle2" color="text.secondary">
            共有ユーザー
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {data.sharedUsers.map((user: string) => (
              <Chip key={user} label={user} size="small" />
            ))}
          </Stack>
        </Box>
      )}

      <Box>
        <Typography variant="subtitle2" color="text.secondary">
          詳細設定
        </Typography>
        <Stack spacing={1}>
          {data?.enableVersioning && (
            <Chip label="バージョン管理: 有効" size="small" color="success" />
          )}
          {data?.enableEncryption && <Chip label="暗号化: 有効" size="small" color="warning" />}
        </Stack>
      </Box>

      {data?.templates && data.templates.length > 0 && (
        <Box>
          <Typography variant="subtitle2" color="text.secondary">
            テンプレート
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {data.templates.map((template: string) => (
              <Chip key={template} label={template} size="small" variant="outlined" />
            ))}
          </Stack>
        </Box>
      )}

      {data?.tags && data.tags.length > 0 && (
        <Box>
          <Typography variant="subtitle2" color="text.secondary">
            タグ
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {data.tags.map((tag: string) => (
              <Chip key={tag} label={tag} size="small" icon={<Tag />} />
            ))}
          </Stack>
        </Box>
      )}
    </Stack>
  </Box>
);

// フォルダー作成のステップ定義
const folderCreationSteps: DialogStep[] = [
  {
    id: 'basic',
    label: '基本情報',
    optional: false,
    component: <FolderBasicInfoStep />,
    icon: <Folder />,
  },
  {
    id: 'permissions',
    label: '権限設定',
    optional: false,
    component: <FolderPermissionsStep />,
    icon: <Settings />,
  },
  {
    id: 'templates',
    label: 'テンプレート',
    optional: true,
    component: <FolderTemplatesStep />,
    icon: <Tag />,
  },
  {
    id: 'review',
    label: '確認',
    optional: false,
    component: <FolderReviewStep />,
    icon: <Check />,
  },
];

// ストーリー定義
export const FolderCreationDialog: StoryObj = {
  render: () => {
    const [open, setOpen] = useState(true);
    const [activeStep, setActiveStep] = useState(0);
    const [data, setData] = useState({});

    const stepsWithData = folderCreationSteps.map((step) => ({
      ...step,
      component: React.cloneElement(step.component as React.ReactElement, {
        data,
        onDataChange: setData,
      }),
    }));

    return (
      <JotaiProvider>
        <MultiStepDialogEnhanced
          open={open}
          title="新しいフォルダーを作成"
          steps={stepsWithData}
          activeStep={activeStep}
          onStepChange={setActiveStep}
          onClose={() => setOpen(false)}
          onSubmit={async (finalData) => {
            console.log('フォルダー作成データ:', finalData);
            alert('フォルダーが作成されました！');
            setOpen(false);
          }}
          maxWidth="md"
          supportsDraft
          currentData={data}
          onDataChange={setData}
        />
      </JotaiProvider>
    );
  },
};

export const FolderCreationBatchMode: StoryObj = {
  render: () => {
    const [open, setOpen] = useState(true);
    const [activeStep, setActiveStep] = useState(0);
    const [data, setData] = useState({
      name: 'バッチ処理用フォルダー',
      folderType: 'standard',
      permissions: 'private',
    });

    const stepsWithData = folderCreationSteps.map((step) => ({
      ...step,
      component: React.cloneElement(step.component as React.ReactElement, {
        data,
        onDataChange: setData,
      }),
    }));

    return (
      <JotaiProvider>
        <MultiStepDialogEnhanced
          open={open}
          title="フォルダー一括作成"
          steps={stepsWithData}
          activeStep={activeStep}
          onStepChange={setActiveStep}
          onClose={() => setOpen(false)}
          onSubmit={async (finalData) => {
            console.log('バッチフォルダー作成データ:', finalData);
            alert('複数のフォルダーがバッチ処理で作成されました！');
            setOpen(false);
          }}
          maxWidth="md"
          nonLinear
          currentData={data}
          onDataChange={setData}
        />
      </JotaiProvider>
    );
  },
};

export const FolderCreationFullscreen: StoryObj = {
  render: () => {
    const [open, setOpen] = useState(true);
    const [activeStep, setActiveStep] = useState(0);
    const [data, setData] = useState({});

    const stepsWithData = folderCreationSteps.map((step) => ({
      ...step,
      component: React.cloneElement(step.component as React.ReactElement, {
        data,
        onDataChange: setData,
      }),
    }));

    return (
      <JotaiProvider>
        <MultiStepDialogEnhanced
          open={open}
          title="フォルダー作成 - フルスクリーンモード"
          steps={stepsWithData}
          activeStep={activeStep}
          onStepChange={setActiveStep}
          onClose={() => setOpen(false)}
          onSubmit={async (finalData) => {
            console.log('フォルダー作成データ:', finalData);
            alert('フォルダーが作成されました！');
            setOpen(false);
          }}
          fullScreen
          autoHideHeader
          autoHideFooter
          currentData={data}
          onDataChange={setData}
        />
      </JotaiProvider>
    );
  },
};

// ルーターベースのプレビュー（参考用）
export const RouterBasedDialog: StoryObj = {
  render: () => (
    <JotaiProvider>
      <MemoryRouter initialEntries={['/dialog/folder/create/abc-123?step=1']}>
        <Box sx={{ height: '100vh' }}>
          <Typography variant="h6" sx={{ p: 2 }}>
            Router-based Plugin Dialog (開発中)
          </Typography>
          <Typography variant="body2" sx={{ px: 2, color: 'text.secondary' }}>
            URL: /dialog/folder/create/abc-123?step=1
          </Typography>
          {/* <PluginDialogRoute /> */}
        </Box>
      </MemoryRouter>
    </JotaiProvider>
  ),
};
