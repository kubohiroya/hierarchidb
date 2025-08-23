# BaseMap Plugin Implementation Guide

BaseMapプラグインの開発・実装に関するガイドです。段階的な開発手順、ベストプラクティス、実装のポイントについて説明します。

## 実装状況

### ✅ 完了済み（Phase 1）

#### エンティティ設計
- BaseMapEntity型定義の完成
- MapLibre GL Style仕様サポート
- WorkingCopy型定義の実装
- デフォルト値とプリセットの定義

#### エンティティハンドラー
- BaseMapEntityHandlerの基本実装
- PeerEntityHandlerパターンの適用
- CRUD操作の実装
- WorkingCopyパターンのサポート
- プラグイン固有のAPI実装

#### UI基盤
- ステッパーダイアログフレームワーク
- 4段階設定ウィザードの構造
- フォームバリデーション基盤
- MUIコンポーネントの統合

#### プラグイン設定
- plugin.config.tsの完成
- NodeTypeDefinitionの実装
- データベーススキーマ定義
- ライフサイクルフック定義

### 🔄 進行中（Phase 2）

#### UI完成度向上
- 地図プレビューコンポーネントの実装
- ステップコンポーネントの詳細実装
- エラーハンドリングの強化
- アクセシビリティ対応

#### データベース統合
- Dexieデータベース接続
- インデックス最適化
- TTLクリーンアップ機能
- マイグレーション対応

### 📋 計画済み（Phase 3-4）

#### 高度な機能
- タイルキャッシュシステム
- カスタムスタイルエディター
- 地図共有機能
- 一括インポート/エクスポート

#### パフォーマンス最適化
- レイジーローディング強化
- メモリ管理最適化
- バンドルサイズ削減

## 開発環境セットアップ

### 必要な依存関係

```bash
# プロジェクトルートで実行
pnpm install

# BaseMapプラグイン固有の依存関係は自動でインストールされます
cd packages/plugins/basemap
pnpm install
```

### 開発サーバー起動

```bash
# プロジェクトルートで実行
pnpm dev

# BaseMapプラグインを含むアプリケーション全体が起動します
# http://localhost:5173 でアクセス可能
```

### TypeScript型チェック

```bash
# BaseMapプラグインの型チェック
cd packages/plugins/basemap
pnpm typecheck

# プロジェクト全体の型チェック
pnpm typecheck
```

## 実装手順

### Phase 2: UI完成度向上

#### 2.1 ステップコンポーネントの詳細実装

**Step1BasicInformation.tsx**

```typescript
import React from 'react';
import { TextField, Box, Typography } from '@mui/material';

interface Step1BasicInformationProps {
  name: string;
  description: string;
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
  nameError?: string;
  descriptionError?: string;
}

export const Step1BasicInformation: React.FC<Step1BasicInformationProps> = ({
  name,
  description,
  onNameChange,
  onDescriptionChange,
  nameError,
  descriptionError,
}) => {
  return (
    <Box sx={{ p: 3, height: '100%' }}>
      <Typography variant="h6" sx={{ mb: 3 }}>
        Basic Information
      </Typography>
      
      <TextField
        label="Map Name"
        fullWidth
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        error={!!nameError}
        helperText={nameError || 'Enter a descriptive name for the map'}
        required
        sx={{ mb: 3 }}
      />
      
      <TextField
        label="Description"
        fullWidth
        multiline
        rows={4}
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        error={!!descriptionError}
        helperText={descriptionError || 'Optional description for the map'}
      />
    </Box>
  );
};
```

**Step2MapStyle.tsx**

```typescript
import React from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Card,
  CardContent,
  Grid,
} from '@mui/material';
import type { BaseMapEntity } from '../types';

interface Step2MapStyleProps {
  mapStyle: BaseMapEntity['mapStyle'];
  styleUrl: string;
  apiKey: string;
  onMapStyleChange: (mapStyle: BaseMapEntity['mapStyle']) => void;
  onStyleUrlChange: (styleUrl: string) => void;
  onApiKeyChange: (apiKey: string) => void;
}

const mapStyleOptions = [
  { value: 'streets', label: 'Streets', description: 'Standard street map' },
  { value: 'satellite', label: 'Satellite', description: 'Satellite imagery' },
  { value: 'hybrid', label: 'Hybrid', description: 'Satellite with labels' },
  { value: 'terrain', label: 'Terrain', description: 'Topographic terrain' },
  { value: 'custom', label: 'Custom', description: 'Custom MapLibre style' },
];

export const Step2MapStyle: React.FC<Step2MapStyleProps> = ({
  mapStyle,
  styleUrl,
  apiKey,
  onMapStyleChange,
  onStyleUrlChange,
  onApiKeyChange,
}) => {
  return (
    <Box sx={{ p: 3, height: '100%' }}>
      <Typography variant="h6" sx={{ mb: 3 }}>
        Map Style Configuration
      </Typography>
      
      <Grid container spacing={3}>
        {mapStyleOptions.map((option) => (
          <Grid item xs={12} sm={6} md={4} key={option.value}>
            <Card
              sx={{
                cursor: 'pointer',
                border: mapStyle === option.value ? 2 : 1,
                borderColor: mapStyle === option.value ? 'primary.main' : 'grey.300',
              }}
              onClick={() => onMapStyleChange(option.value as BaseMapEntity['mapStyle'])}
            >
              <CardContent>
                <Typography variant="h6">{option.label}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {option.description}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      
      {mapStyle === 'custom' && (
        <Box sx={{ mt: 3 }}>
          <TextField
            label="Style URL"
            fullWidth
            value={styleUrl}
            onChange={(e) => onStyleUrlChange(e.target.value)}
            placeholder="https://example.com/style.json"
            helperText="MapLibre GL Style JSON URL"
            sx={{ mb: 2 }}
          />
        </Box>
      )}
      
      <TextField
        label="API Key (Optional)"
        fullWidth
        value={apiKey}
        onChange={(e) => onApiKeyChange(e.target.value)}
        type="password"
        helperText="API key for external map services"
        sx={{ mt: 2 }}
      />
    </Box>
  );
};
```

#### 2.2 地図プレビューコンポーネント

**BaseMapPreview.tsx**

```typescript
import React, { useEffect, useRef } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import type { BaseMapEntity } from '../types';

interface BaseMapPreviewProps {
  config: Partial<BaseMapEntity>;
  width?: number | string;
  height?: number | string;
}

export const BaseMapPreview: React.FC<BaseMapPreviewProps> = ({
  config,
  width = '100%',
  height = 300,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // MapLibre GL JSの実装
    // 実際の実装では動的importを使用
    const initializeMap = async () => {
      const maplibregl = await import('maplibre-gl');
      
      if (mapRef.current) {
        mapRef.current.remove();
      }

      mapRef.current = new maplibregl.Map({
        container: mapContainerRef.current!,
        style: getStyleUrl(config.mapStyle || 'streets'),
        center: config.center || [0, 0],
        zoom: config.zoom || 10,
        bearing: config.bearing || 0,
        pitch: config.pitch || 0,
      });

      // Display options適用
      if (config.displayOptions) {
        applyDisplayOptions(mapRef.current, config.displayOptions);
      }
    };

    initializeMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
      }
    };
  }, [config]);

  const getStyleUrl = (style: string) => {
    const styleUrls = {
      streets: 'https://tiles.openfreemap.org/styles/positron',
      satellite: 'https://tiles.openfreemap.org/styles/satellite',
      terrain: 'https://tiles.openfreemap.org/styles/terrain',
      hybrid: 'https://tiles.openfreemap.org/styles/hybrid',
    };
    return styleUrls[style as keyof typeof styleUrls] || config.styleUrl;
  };

  const applyDisplayOptions = (map: any, options: BaseMapEntity['displayOptions']) => {
    // 3D建物、ラベル等の表示制御を実装
  };

  return (
    <Paper sx={{ width, height, overflow: 'hidden' }}>
      <div
        ref={mapContainerRef}
        style={{ width: '100%', height: '100%' }}
      />
    </Paper>
  );
};
```

#### 2.3 データベース統合

**BaseMapDatabase.ts**

```typescript
import Dexie, { Table } from 'dexie';
import type { BaseMapEntity, BaseMapWorkingCopy } from '../types';

export interface TileCache {
  tileId: string;
  nodeId: string;
  zoom: number;
  x: number;
  y: number;
  tileData: Blob;
  contentType: string;
  cachedAt: number;
  expiresAt?: number;
}

export class BaseMapDatabase extends Dexie {
  basemaps!: Table<BaseMapEntity>;
  basemap_workingcopies!: Table<BaseMapWorkingCopy>;
  basemap_tiles_cache!: Table<TileCache>;

  constructor() {
    super('BaseMapDB');
    
    this.version(1).stores({
      basemaps: '&nodeId, mapStyle, updatedAt, createdAt',
      basemap_workingcopies: '&workingCopyId, workingCopyOf, copiedAt',
      basemap_tiles_cache: '&tileId, nodeId, zoom, x, y, cachedAt',
    });

    // TTL cleanup hook
    this.basemap_workingcopies.hook('creating', (primKey, obj, trans) => {
      obj.copiedAt = Date.now();
    });

    this.basemap_tiles_cache.hook('creating', (primKey, obj, trans) => {
      obj.cachedAt = Date.now();
      if (!obj.expiresAt) {
        obj.expiresAt = Date.now() + 3600000; // 1 hour
      }
    });
  }

  // TTL cleanup
  async cleanupExpiredEntries() {
    const now = Date.now();
    
    // Working copies older than 24 hours
    await this.basemap_workingcopies
      .where('copiedAt')
      .below(now - 86400000)
      .delete();

    // Tiles older than 1 hour
    await this.basemap_tiles_cache
      .where('cachedAt')
      .below(now - 3600000)
      .delete();
  }

  static instance: BaseMapDatabase | null = null;

  static getInstance(): BaseMapDatabase {
    if (!this.instance) {
      this.instance = new BaseMapDatabase();
    }
    return this.instance;
  }

  static async close(): Promise<void> {
    if (this.instance) {
      await this.instance.close();
      this.instance = null;
    }
  }
}
```

### Phase 3: 高度な機能実装

#### 3.1 タイルキャッシュシステム

```typescript
// TileCache管理クラス
export class TileCacheManager {
  private db: BaseMapDatabase;

  constructor(db: BaseMapDatabase) {
    this.db = db;
  }

  async getTile(nodeId: string, zoom: number, x: number, y: number): Promise<Blob | null> {
    const tileId = `${nodeId}-${zoom}-${x}-${y}`;
    const cached = await this.db.basemap_tiles_cache.get(tileId);
    
    if (cached && (!cached.expiresAt || cached.expiresAt > Date.now())) {
      return cached.tileData;
    }
    
    return null;
  }

  async cacheTile(
    nodeId: string,
    zoom: number,
    x: number,
    y: number,
    tileData: Blob,
    contentType: string = 'image/png'
  ): Promise<void> {
    const tileId = `${nodeId}-${zoom}-${x}-${y}`;
    
    await this.db.basemap_tiles_cache.put({
      tileId,
      nodeId,
      zoom,
      x,
      y,
      tileData,
      contentType,
      cachedAt: Date.now(),
      expiresAt: Date.now() + 3600000, // 1 hour
    });
  }

  async clearCacheForNode(nodeId: string): Promise<void> {
    await this.db.basemap_tiles_cache
      .where('nodeId')
      .equals(nodeId)
      .delete();
  }
}
```

#### 3.2 スタイルエディター

```typescript
// StyleEditor コンポーネント
interface StyleEditorProps {
  style: MapLibreStyleConfig;
  onChange: (style: MapLibreStyleConfig) => void;
}

export const StyleEditor: React.FC<StyleEditorProps> = ({ style, onChange }) => {
  const [jsonValue, setJsonValue] = useState(JSON.stringify(style, null, 2));
  const [error, setError] = useState<string | null>(null);

  const handleJsonChange = (value: string) => {
    setJsonValue(value);
    
    try {
      const parsed = JSON.parse(value);
      setError(null);
      onChange(parsed);
    } catch (e) {
      setError('Invalid JSON format');
    }
  };

  return (
    <Box>
      <Typography variant="h6">Style Editor</Typography>
      <CodeEditor
        value={jsonValue}
        onChange={handleJsonChange}
        language="json"
        error={error}
      />
    </Box>
  );
};
```

## テスト戦略

### 単体テスト

```typescript
// BaseMapEntityHandler.test.ts
import { BaseMapEntityHandler } from './BaseMapEntityHandler';

describe('BaseMapEntityHandler', () => {
  let handler: BaseMapEntityHandler;

  beforeEach(() => {
    handler = new BaseMapEntityHandler();
  });

  describe('createEntity', () => {
    it('should create entity with default values', async () => {
      const nodeId = 'test-node-1' as NodeId;
      const entity = await handler.createEntity(nodeId);

      expect(entity.nodeId).toBe(nodeId);
      expect(entity.mapStyle).toBe('streets');
      expect(entity.center).toEqual([0, 0]);
      expect(entity.zoom).toBe(10);
    });

    it('should validate coordinates', async () => {
      const nodeId = 'test-node-1' as NodeId;
      
      await expect(
        handler.createEntity(nodeId, { center: [200, 0] })
      ).rejects.toThrow('Invalid coordinates');
    });
  });

  describe('working copy operations', () => {
    it('should create and commit working copy', async () => {
      const nodeId = 'test-node-1' as NodeId;
      const entity = await handler.createEntity(nodeId);
      
      const workingCopy = await handler.createWorkingCopy(nodeId);
      expect(workingCopy.workingCopyOf).toBe(nodeId);
      expect(workingCopy.isDirty).toBe(false);

      // Modify working copy
      workingCopy.mapStyle = 'satellite';
      workingCopy.isDirty = true;

      await handler.commitWorkingCopy(nodeId, workingCopy);
      
      const updatedEntity = await handler.getEntity(nodeId);
      expect(updatedEntity?.mapStyle).toBe('satellite');
    });
  });
});
```

### 統合テスト

```typescript
// BaseMapPlugin.integration.test.ts
import { BaseMapDatabase } from '../database/BaseMapDatabase';
import { BaseMapEntityHandler } from '../handlers/BaseMapEntityHandler';

describe('BaseMap Plugin Integration', () => {
  let db: BaseMapDatabase;
  let handler: BaseMapEntityHandler;

  beforeAll(async () => {
    db = new BaseMapDatabase();
    await db.open();
    handler = new BaseMapEntityHandler();
  });

  afterAll(async () => {
    await db.close();
  });

  it('should complete full CRUD cycle', async () => {
    const nodeId = 'integration-test-1' as NodeId;
    
    // Create
    const entity = await handler.createEntity(nodeId, {
      mapStyle: 'terrain',
      center: [139.6917, 35.6895], // Tokyo
      zoom: 12,
    });

    // Read
    const retrieved = await handler.getEntity(nodeId);
    expect(retrieved).toEqual(entity);

    // Update
    await handler.updateEntity(nodeId, { zoom: 15 });
    const updated = await handler.getEntity(nodeId);
    expect(updated?.zoom).toBe(15);

    // Delete
    await handler.deleteEntity(nodeId);
    const deleted = await handler.getEntity(nodeId);
    expect(deleted).toBeUndefined();
  });
});
```

### E2Eテスト

```typescript
// basemap.e2e.test.ts
import { test, expect } from '@playwright/test';

test.describe('BaseMap Plugin E2E', () => {
  test('complete basemap creation flow', async ({ page }) => {
    await page.goto('/app');
    
    // Open create dialog
    await page.click('[data-testid="create-node-button"]');
    await page.click('[data-testid="node-type-basemap"]');
    
    // Step 1: Basic Information
    await page.fill('[data-testid="map-name"]', 'Test Map');
    await page.fill('[data-testid="map-description"]', 'Test Description');
    await page.click('text=Next');
    
    // Step 2: Map Style
    await page.click('[data-testid="style-satellite"]');
    await page.click('text=Next');
    
    // Step 3: View Settings
    await page.fill('[data-testid="longitude"]', '139.6917');
    await page.fill('[data-testid="latitude"]', '35.6895');
    await page.fill('[data-testid="zoom"]', '12');
    await page.click('text=Next');
    
    // Step 4: Preview and Create
    await expect(page.locator('[data-testid="map-preview"]')).toBeVisible();
    await page.click('text=Create Map');
    
    // Verify creation
    await expect(page.locator('text=Test Map')).toBeVisible();
  });

  test('edit existing basemap', async ({ page }) => {
    // Similar flow for editing...
  });
});
```

## デバッグとトラブルシューティング

### 開発ツール

```typescript
// デバッグ用ヘルパー
export const BaseMapDebugger = {
  logEntityState: (entity: BaseMapEntity) => {
    console.group('BaseMap Entity State');
    console.log('NodeId:', entity.nodeId);
    console.log('Style:', entity.mapStyle);
    console.log('Center:', entity.center);
    console.log('Zoom:', entity.zoom);
    console.groupEnd();
  },

  validateStyle: (style: MapLibreStyleConfig) => {
    const errors: string[] = [];
    
    if (!style.version || style.version !== 8) {
      errors.push('Style version must be 8');
    }
    
    if (!style.sources || Object.keys(style.sources).length === 0) {
      errors.push('Style must have at least one source');
    }
    
    if (!style.layers || style.layers.length === 0) {
      errors.push('Style must have at least one layer');
    }
    
    return errors;
  },
};
```

### 一般的な問題と解決方法

#### 1. スタイルが読み込まれない

```typescript
// スタイルURLの検証
const validateStyleUrl = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(url);
    if (!response.ok) return false;
    
    const style = await response.json();
    return style.version === 8 && style.sources && style.layers;
  } catch {
    return false;
  }
};
```

#### 2. 座標が正しく表示されない

```typescript
// 座標変換ヘルパー
export const CoordinateHelper = {
  // WGS84 to Web Mercator
  toWebMercator: ([lng, lat]: [number, number]): [number, number] => {
    const x = lng * 20037508.34 / 180;
    let y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180);
    y = y * 20037508.34 / 180;
    return [x, y];
  },

  // Validate coordinates
  isValidLngLat: ([lng, lat]: [number, number]): boolean => {
    return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
  },
};
```

## パフォーマンス最適化

### メモリ管理

```typescript
// 自動クリーンアップ
export const setupAutoCleanup = () => {
  const db = BaseMapDatabase.getInstance();
  
  // 1時間ごとにクリーンアップ実行
  setInterval(async () => {
    try {
      await db.cleanupExpiredEntries();
      console.log('BaseMap cache cleanup completed');
    } catch (error) {
      console.error('Cache cleanup failed:', error);
    }
  }, 3600000); // 1 hour
};
```

### バンドルサイズ最適化

```typescript
// MapLibre GL の動的インポート
const loadMapLibre = async () => {
  const { Map } = await import('maplibre-gl');
  return Map;
};

// レイジーローディング
const BaseMapPreview = React.lazy(() => 
  import('./BaseMapPreview').then(module => ({
    default: module.BaseMapPreview
  }))
);
```

## デプロイメント

### ビルド設定

```typescript
// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/openstreetmap-type.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  external: [
    'react',
    'react-dom',
    '@mui/material',
    '@mui/icons-material',
    'maplibre-gl',
  ],
  treeshake: true,
  splitting: false,
});
```

### 本番環境での注意点

1. **APIキーの管理**: 環境変数でAPIキーを管理
2. **CORS設定**: 外部タイルサーバーのCORS設定確認
3. **キャッシュ戦略**: CDN設定とキャッシュヘッダー
4. **パフォーマンス監視**: タイル読み込み時間の監視

これで、BaseMapプラグインの包括的な実装ガイドが完成しました。段階的な開発アプローチにより、確実に機能を構築していくことができます。