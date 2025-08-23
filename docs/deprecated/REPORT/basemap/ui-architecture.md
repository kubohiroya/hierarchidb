# BaseMap Plugin UI Architecture

BaseMapプラグインのReactコンポーネント構成とUIアーキテクチャについて説明します。

## アーキテクチャ概要

BaseMapプラグインは、HierarchiDBの4層アーキテクチャに従い、UIレイヤーでReact/MUIコンポーネントを使用しています：

```
UI Components (React/MUI) ←→ useWorkerAPI ←→ Comlink RPC ←→ Worker Layer
```

### 主要コンポーネント

- **ダイアログコンポーネント**: 地図作成・編集用のステッパーダイアログ
- **ステップコンポーネント**: 段階的な設定ウィザード
- **プレビューコンポーネント**: 地図設定のプレビュー表示
- **フォームコンポーネント**: 設定項目の入力フォーム

## コンポーネント階層

### メインダイアログ構造

```
BaseMapDialog
├── BaseMapStepperDialog
    ├── Step1BasicInformation
    ├── Step2MapStyle
    ├── Step3MapView
    └── Step4Preview
```

### サポートコンポーネント

```
BaseMapEditor      # レガシーエディター
BaseMapPanel       # ビューパネル
BaseMapForm        # インラインフォーム
BaseMapIcon        # ツリー表示アイコン
BaseMapView        # 地図表示コンポーネント
BaseMapPreview     # プレビューコンポーネント
```

## 主要コンポーネント詳細

### 1. BaseMapDialog

メインエントリーポイントとなるダイアログコンポーネント：

```typescript
interface BaseMapDialogProps {
  open: boolean;
  nodeId?: NodeId;
  entity?: BaseMapEntity;
  workingCopy?: BaseMapWorkingCopy;
  onClose: () => void;
  onSave: (data: Partial<BaseMapEntity>) => void;
  mode?: 'create' | 'edit';
}

export const BaseMapDialog: React.FC<BaseMapDialogProps> = ({
  open,
  nodeId,
  entity,
  workingCopy,
  onClose,
  onSave,
  mode = 'create',
}) => {
  return (
    <BaseMapStepperDialog
      open={open}
      nodeId={nodeId}
      entity={entity}
      workingCopy={workingCopy}
      onClose={onClose}
      onSave={onSave}
      mode={mode}
    />
  );
};
```

### 2. BaseMapStepperDialog

4段階のステップ形式で地図設定を行うメインダイアログ：

```typescript
interface BaseMapStepperDialogProps {
  open: boolean;
  nodeId?: NodeId;
  entity?: BaseMapEntity;
  workingCopy?: BaseMapWorkingCopy;
  onClose: () => void;
  onSave: (data: Partial<BaseMapEntity>) => void;
  mode?: 'create' | 'edit';
}

const steps = [
  'Basic Information',    // 基本情報
  'Map Style',           // 地図スタイル
  'View Settings',       // 表示設定
  'Preview',             // プレビュー
];

interface FormData {
  name: string;
  description: string;
  mapStyle: BaseMapEntity['mapStyle'];
  styleUrl: string;
  apiKey: string;
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
  displayOptions: BaseMapEntity['displayOptions'];
}
```

#### 主要機能
- **段階的設定**: 4つのステップでの設定ガイド
- **データ検証**: 各ステップでの入力検証
- **プレビュー機能**: 設定内容のリアルタイムプレビュー
- **作業コピー**: ドラフト編集機能

## ステップコンポーネント詳細

### Step1BasicInformation

基本情報入力ステップ：

```typescript
interface Step1BasicInformationProps {
  name: string;
  description: string;
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
  nameError?: string;
  descriptionError?: string;
}
```

**設定項目:**
- 地図名（必須）
- 地図の説明（任意）

**検証ルール:**
- 地図名は必須入力
- 地図名は1文字以上、100文字以下

### Step2MapStyle

地図スタイル選択ステップ：

```typescript
interface Step2MapStyleProps {
  mapStyle: BaseMapEntity['mapStyle'];
  styleUrl: string;
  apiKey: string;
  onMapStyleChange: (mapStyle: BaseMapEntity['mapStyle']) => void;
  onStyleUrlChange: (styleUrl: string) => void;
  onApiKeyChange: (apiKey: string) => void;
}
```

**設定項目:**
- 地図スタイル選択（streets/satellite/hybrid/terrain/custom）
- カスタムスタイルURL（customの場合）
- APIキー（外部サービス利用時）

**検証ルール:**
- customスタイル選択時はURL必須
- URL形式の検証
- APIキーの形式検証

### Step3MapView

地図表示設定ステップ：

```typescript
interface Step3MapViewProps {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
  displayOptions: BaseMapEntity['displayOptions'];
  onCenterChange: (center: [number, number]) => void;
  onZoomChange: (zoom: number) => void;
  onBearingChange: (bearing: number) => void;
  onPitchChange: (pitch: number) => void;
  onDisplayOptionsChange: (options: BaseMapEntity['displayOptions']) => void;
}
```

**設定項目:**
- 中心座標（経度・緯度）
- ズームレベル（0-22）
- 回転角度（0-360度）
- 傾斜角度（0-60度）
- 表示オプション（3D建物、交通情報、交通機関、地形、ラベル）

**検証ルール:**
- 経度: -180 ～ 180
- 緯度: -90 ～ 90
- ズーム: 0 ～ 22
- 回転: 0 ～ 360
- 傾斜: 0 ～ 60

### Step4Preview

設定プレビューステップ：

```typescript
interface Step4PreviewProps {
  name: string;
  description: string;
  mapStyle: BaseMapEntity['mapStyle'];
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
  displayOptions: BaseMapEntity['displayOptions'];
  styleUrl?: string;
  apiKey?: string;
}
```

**機能:**
- 設定内容の確認表示
- 地図のプレビュー表示
- 設定変更箇所のハイライト
- 最終確認とバリデーション

## 状態管理

### フォームデータ管理

```typescript
const [formData, setFormData] = useState<FormData>(() => {
  const baseData = workingCopy || entity;
  if (baseData) {
    return {
      name: baseData.name || '',
      description: baseData.description || '',
      mapStyle: baseData.mapStyle,
      styleUrl: baseData.styleUrl || '',
      apiKey: baseData.apiKey || '',
      center: baseData.center,
      zoom: baseData.zoom,
      bearing: baseData.bearing,
      pitch: baseData.pitch,
      displayOptions: baseData.displayOptions || defaultDisplayOptions,
    };
  }
  return defaultFormData;
});

const updateFormData = (updates: Partial<FormData>) => {
  setFormData(prev => ({ ...prev, ...updates }));
  setErrors(prev => {
    const newErrors = { ...prev };
    // Clear errors for updated fields
    Object.keys(updates).forEach(key => {
      delete newErrors[key as keyof FormData];
    });
    return newErrors;
  });
};
```

### エラー管理

```typescript
const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

const validateStep = useCallback((step: number): boolean => {
  const newErrors: typeof errors = {};

  switch (step) {
    case 0: // Basic Information
      if (!formData.name.trim()) {
        newErrors.name = 'Map name is required';
      }
      break;
    case 1: // Map Style
      if (formData.mapStyle === 'custom' && !formData.styleUrl.trim()) {
        newErrors.styleUrl = 'Style URL is required for custom style';
      }
      break;
    case 2: // View Settings
      if (formData.center[0] < -180 || formData.center[0] > 180) {
        newErrors.center = 'Longitude must be between -180 and 180';
      }
      if (formData.center[1] < -90 || formData.center[1] > 90) {
        newErrors.center = 'Latitude must be between -90 and 90';
      }
      break;
  }

  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
}, [formData]);
```

## UIライブラリとスタイル

### Material-UI (MUI) コンポーネント

使用している主要MUIコンポーネント：

```typescript
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stepper,
  Step,
  StepLabel,
  Box,
  IconButton,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Typography,
  Card,
  CardContent,
} from '@mui/material';

import {
  Close as CloseIcon,
  Map as MapIcon,
  Public as PublicIcon,
  Satellite as SatelliteIcon,
  Terrain as TerrainIcon,
} from '@mui/icons-material';
```

### テーマとスタイリング

```typescript
// ダイアログのスタイル設定
<Dialog
  open={open}
  onClose={onClose}
  maxWidth="md"
  fullWidth
  PaperProps={{
    sx: { height: '80vh', maxHeight: 800 }
  }}
>

// コンテンツエリアのスタイル
<DialogContent sx={{ p: 0, overflow: 'hidden' }}>
  <Box sx={{ 
    height: 'calc(100% - 80px)', 
    overflow: 'auto',
    '& > div': { minHeight: '100%' }
  }}>
    {renderStepContent(activeStep)}
  </Box>
</DialogContent>
```

## データフロー

### UI ←→ Worker通信

```typescript
// Worker APIを使用したデータ操作
const handleSave = async () => {
  try {
    const saveData: Partial<BaseMapEntity> = {
      name: formData.name,
      description: formData.description,
      mapStyle: formData.mapStyle,
      center: formData.center,
      zoom: formData.zoom,
      bearing: formData.bearing,
      pitch: formData.pitch,
      displayOptions: formData.displayOptions,
    };

    await workerAPI.basemap.updateEntity(nodeId, saveData);
    onSave(saveData);
  } catch (error) {
    console.error('Failed to save basemap:', error);
    // エラーハンドリング
  }
};
```

### 作業コピーパターン

```typescript
// 作業コピーの作成
const createWorkingCopy = async (nodeId: NodeId) => {
  const workingCopy = await workerAPI.basemap.createWorkingCopy(nodeId);
  setWorkingCopy(workingCopy);
};

// 変更のコミット
const commitChanges = async () => {
  if (workingCopy) {
    await workerAPI.basemap.commitWorkingCopy(nodeId, workingCopy);
  }
};

// 変更の破棄
const discardChanges = async () => {
  if (workingCopy) {
    await workerAPI.basemap.discardWorkingCopy(nodeId);
  }
};
```

## アクセシビリティ

### キーボードナビゲーション

- タブキーでのフォーカス移動
- Enterキーでの次ステップ移動
- Escapeキーでのダイアログクローズ

### スクリーンリーダー対応

```typescript
// ARIA属性の適切な設定
<IconButton onClick={onClose} size="small" aria-label="Close dialog">
  <CloseIcon />
</IconButton>

<TextField
  label="Map Name"
  value={name}
  onChange={(e) => onNameChange(e.target.value)}
  error={!!nameError}
  helperText={nameError}
  aria-describedby={nameError ? 'name-error' : undefined}
  required
/>
```

## パフォーマンス最適化

### レイジーローディング

```typescript
// コンポーネントのレイジーローディング
const BaseMapStepperDialog = lazy(() => 
  import('./BaseMapStepperDialog').then(m => ({ 
    default: m.BaseMapStepperDialog 
  }))
);
```

### メモ化

```typescript
// 計算コストの高い処理のメモ化
const validateStep = useCallback((step: number): boolean => {
  // バリデーション処理
}, [formData]);

const renderStepContent = useMemo(() => (step: number) => {
  // ステップコンテンツのレンダリング
}, [formData, errors]);
```

## 国際化 (i18n)

### 多言語対応

```typescript
// i18nextを使用した国際化
import { useTranslation } from 'react-i18next';

const { t } = useTranslation('plugin-basemap');

// テキストの翻訳
<Typography variant="h6">
  {t('dialog.title.create')}
</Typography>

<TextField
  label={t('form.name.label')}
  helperText={t('form.name.helper')}
/>
```

### ロケールファイル

```json
// packages/plugins/basemap/src/locales/en/core.json
{
  "dialog": {
    "title": {
      "create": "Create Base Map",
      "edit": "Edit Base Map"
    }
  },
  "form": {
    "name": {
      "label": "Map Name",
      "helper": "Enter a descriptive name for the map"
    }
  },
  "steps": {
    "basicInfo": "Basic Information",
    "mapStyle": "Map Style",
    "viewSettings": "View Settings",
    "preview": "Preview"
  }
}
```

## テスト戦略

### コンポーネントテスト

```typescript
// Jest + React Testing Libraryを使用
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BaseMapStepperDialog } from './BaseMapStepperDialog';

describe('BaseMapStepperDialog', () => {
  it('should render all steps', () => {
    render(
      <BaseMapStepperDialog
        open={true}
        onClose={() => {}}
        onSave={() => {}}
      />
    );

    expect(screen.getByText('Basic Information')).toBeInTheDocument();
    expect(screen.getByText('Map Style')).toBeInTheDocument();
    expect(screen.getByText('View Settings')).toBeInTheDocument();
    expect(screen.getByText('Preview')).toBeInTheDocument();
  });

  it('should validate required fields', async () => {
    const onSave = jest.fn();
    render(
      <BaseMapStepperDialog
        open={true}
        onClose={() => {}}
        onSave={onSave}
      />
    );

    // 名前なしで次へ進む
    fireEvent.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(screen.getByText('Map name is required')).toBeInTheDocument();
    });
  });
});
```

### E2Eテスト

```typescript
// Playwrightを使用したE2Eテスト
import { test, expect } from '@playwright/test';

test('BaseMap creation flow', async ({ page }) => {
  await page.goto('/app');
  
  // 地図作成ボタンをクリック
  await page.click('[data-testid="create-basemap-button"]');
  
  // ダイアログが表示される
  await expect(page.locator('[role="dialog"]')).toBeVisible();
  
  // 基本情報を入力
  await page.fill('[data-testid="map-name-input"]', 'Test Map');
  
  // 次のステップへ
  await page.click('text=Next');
  
  // プレビューまで進む
  await page.click('text=Next');
  await page.click('text=Next');
  
  // 作成実行
  await page.click('text=Create Map');
  
  // 作成成功の確認
  await expect(page.locator('text=Test Map')).toBeVisible();
});
```

## 今後の拡張予定

### 高度な機能

- 地図スタイルエディター
- 複数地図の比較表示
- 地図レイヤーの管理
- カスタムアイコンのサポート

### パフォーマンス改善

- 仮想スクロール対応
- 画像の遅延読み込み
- キャッシュ戦略の最適化
- バンドルサイズの削減