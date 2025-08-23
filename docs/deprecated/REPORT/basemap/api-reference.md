# BaseMap Plugin API Reference

BaseMapプラグインの完全なAPI仕様書です。型定義、インターフェース、メソッド、および使用例を含みます。

## 型定義

### 基本型

#### BaseMapEntity

```typescript
interface BaseMapEntity extends PeerEntity {
  nodeId: NodeId;

  // Map style configuration
  mapStyle: 'streets' | 'satellite' | 'hybrid' | 'terrain' | 'custom';
  styleUrl?: string;
  styleConfig?: MapLibreStyleConfig;

  // Map viewport settings
  center: [number, number]; // [longitude, latitude]
  zoom: number; // Zoom level (0-22)
  bearing: number; // Rotation angle in degrees (0-360)
  pitch: number; // Tilt angle in degrees (0-60)

  // Map bounds (optional)
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };

  // Display options
  displayOptions?: {
    show3dBuildings?: boolean;
    showTraffic?: boolean;
    showTransit?: boolean;
    showTerrain?: boolean;
    showLabels?: boolean;
  };

  // Access configuration
  apiKey?: string;
  attribution?: string;

  // Metadata
  thumbnailUrl?: string;
  tags?: string[];

  // Timestamps
  createdAt: number;
  updatedAt: number;
  version: number;
}
```

#### BaseMapWorkingCopy

```typescript
interface BaseMapWorkingCopy extends WorkingCopy {
  // All BaseMapEntity fields
  nodeId: NodeId;
  mapStyle: 'streets' | 'satellite' | 'hybrid' | 'terrain' | 'custom';
  styleUrl?: string;
  styleConfig?: MapLibreStyleConfig;
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
  bounds?: BaseMapEntity['bounds'];
  displayOptions?: BaseMapEntity['displayOptions'];
  apiKey?: string;
  attribution?: string;
  thumbnailUrl?: string;
  tags?: string[];

  // Working copy metadata
  workingCopyId: string;
  workingCopyOf: NodeId;
  copiedAt: number;
  isDirty: boolean;

  // Timestamps
  createdAt: number;
  updatedAt: number;
  version: number;
}
```

#### MapLibreStyleConfig

```typescript
interface MapLibreStyleConfig {
  version: number;
  name?: string;
  metadata?: SourceMetadata;

  // Data sources
  sources: Record<string, {
    type: 'vector' | 'raster' | 'raster-dem' | 'geojson' | 'image' | 'video';
    tiles?: string[];
    url?: string;
    minzoom?: number;
    maxzoom?: number;
    tileSize?: number;
    scheme?: 'xyz' | 'tms';
    attribution?: string;
    metadata?: SourceMetadata;
  }>;

  // Map layers
  layers: Array<{
    id: string;
    type: 'fill' | 'line' | 'symbol' | 'circle' | 'heatmap' | 
          'fill-extrusion' | 'raster' | 'hillshade' | 'background';
    source?: string;
    'source-layer'?: string;
    minzoom?: number;
    maxzoom?: number;
    filter?: FilterExpression[];
    layout?: LayerLayoutProperties;
    paint?: LayerPaintProperties;
    metadata?: LayerMetadata;
  }>;

  // Additional configuration
  sprite?: string;
  glyphs?: string;
  center?: [number, number];
  zoom?: number;
  bearing?: number;
  pitch?: number;

  // Extensions
  [key: string]: unknown;
}
```

#### TileCache

```typescript
interface TileCache {
  tileId: string; // Constructed from nodeId + zoom + x + y
  nodeId: string;
  zoom: number;
  x: number;
  y: number;
  tileData: Blob;
  contentType: string;
  cachedAt: number;
  expiresAt?: number;
}
```

### 補助型定義

#### StyleExpression

```typescript
type StyleExpression = 
  | string
  | number
  | boolean
  | (string | number | boolean)[]
  | { [key: string]: StyleExpression };
```

#### FilterExpression

```typescript
type FilterExpression = 
  | ['==', string, StyleExpression]
  | ['!=', string, StyleExpression]
  | ['>', string, number]
  | ['>=', string, number]
  | ['<', string, number]
  | ['<=', string, number]
  | ['in', string, ...StyleExpression[]]
  | ['!in', string, ...StyleExpression[]]
  | ['has', string]
  | ['!has', string]
  | ['all', ...FilterExpression[]]
  | ['any', ...FilterExpression[]]
  | ['none', ...FilterExpression[]]
  | boolean;
```

## EntityHandler API

### BaseMapEntityHandler

BaseMapEntityHandlerは、BaseMapエンティティの操作を担当するメインハンドラーです。

#### コンストラクタ

```typescript
constructor()
```

BaseMapEntityHandlerのインスタンスを作成します。データベース接続はプラグインシステムによって自動的に注入されます。

#### メソッド

##### createEntity

```typescript
async createEntity(
  nodeId: NodeId, 
  data?: Partial<BaseMapEntity>
): Promise<BaseMapEntity>
```

新しいBaseMapエンティティを作成します。

**パラメータ:**
- `nodeId`: 関連するTreeNodeのID
- `data`: エンティティの初期データ（オプション）

**戻り値:**
作成されたBaseMapEntityオブジェクト

**エラー:**
- `ValidationError`: 無効なデータが提供された場合
- `DatabaseError`: データベース操作が失敗した場合

**使用例:**
```typescript
const handler = new BaseMapEntityHandler();
const entity = await handler.createEntity(
  'node-123' as NodeId,
  {
    mapStyle: 'satellite',
    center: [139.6917, 35.6895], // Tokyo
    zoom: 12,
  }
);
```

##### getEntity

```typescript
async getEntity(nodeId: NodeId): Promise<BaseMapEntity | undefined>
```

指定されたNodeIdに関連するBaseMapエンティティを取得します。

**パラメータ:**
- `nodeId`: 取得するエンティティのNodeId

**戻り値:**
BaseMapEntityオブジェクト、または存在しない場合はundefined

**使用例:**
```typescript
const entity = await handler.getEntity('node-123' as NodeId);
if (entity) {
  console.log('Map style:', entity.mapStyle);
}
```

##### updateEntity

```typescript
async updateEntity(
  nodeId: NodeId, 
  data: Partial<BaseMapEntity>
): Promise<void>
```

既存のBaseMapエンティティを更新します。

**パラメータ:**
- `nodeId`: 更新するエンティティのNodeId
- `data`: 更新するフィールド

**エラー:**
- `EntityNotFoundError`: エンティティが存在しない場合
- `ValidationError`: 無効なデータが提供された場合

**使用例:**
```typescript
await handler.updateEntity('node-123' as NodeId, {
  zoom: 15,
  center: [139.6917, 35.6895],
});
```

##### deleteEntity

```typescript
async deleteEntity(nodeId: NodeId): Promise<void>
```

BaseMapエンティティを削除します。関連するタイルキャッシュも自動的にクリアされます。

**パラメータ:**
- `nodeId`: 削除するエンティティのNodeId

**エラー:**
- `EntityNotFoundError`: エンティティが存在しない場合
- `DatabaseError`: データベース操作が失敗した場合

**使用例:**
```typescript
await handler.deleteEntity('node-123' as NodeId);
```

#### Working Copy メソッド

##### createWorkingCopy

```typescript
async createWorkingCopy(nodeId: NodeId): Promise<BaseMapWorkingCopy>
```

既存のエンティティから作業コピーを作成します。

**パラメータ:**
- `nodeId`: 作業コピーを作成するエンティティのNodeId

**戻り値:**
作成されたBaseMapWorkingCopyオブジェクト

**エラー:**
- `EntityNotFoundError`: エンティティが存在しない場合

**使用例:**
```typescript
const workingCopy = await handler.createWorkingCopy('node-123' as NodeId);
// 作業コピーを編集
workingCopy.zoom = 15;
workingCopy.isDirty = true;
```

##### commitWorkingCopy

```typescript
async commitWorkingCopy(
  nodeId: NodeId, 
  workingCopy: BaseMapWorkingCopy
): Promise<void>
```

作業コピーの変更をメインエンティティにコミットします。

**パラメータ:**
- `nodeId`: エンティティのNodeId
- `workingCopy`: コミットする作業コピー

**エラー:**
- `EntityNotFoundError`: エンティティが存在しない場合
- `VersionConflictError`: バージョン競合が発生した場合

**使用例:**
```typescript
await handler.commitWorkingCopy('node-123' as NodeId, workingCopy);
```

##### discardWorkingCopy

```typescript
async discardWorkingCopy(nodeId: NodeId): Promise<void>
```

作業コピーを破棄します。

**パラメータ:**
- `nodeId`: エンティティのNodeId

**使用例:**
```typescript
await handler.discardWorkingCopy('node-123' as NodeId);
```

#### プラグイン固有メソッド

##### changeMapStyle

```typescript
async changeMapStyle(
  nodeId: NodeId, 
  style: BaseMapEntity['mapStyle']
): Promise<void>
```

地図スタイルを変更し、関連するタイルキャッシュをクリアします。

**パラメータ:**
- `nodeId`: エンティティのNodeId
- `style`: 新しい地図スタイル

**使用例:**
```typescript
await handler.changeMapStyle('node-123' as NodeId, 'satellite');
```

##### setBounds

```typescript
async setBounds(
  nodeId: NodeId, 
  bounds: [[number, number], [number, number]]
): Promise<void>
```

地図の表示範囲を設定し、中心点とズームレベルを自動計算します。

**パラメータ:**
- `nodeId`: エンティティのNodeId
- `bounds`: 境界座標 [[west, south], [east, north]]

**使用例:**
```typescript
await handler.setBounds('node-123' as NodeId, [
  [139.5, 35.5], // 南西
  [139.8, 35.8]  // 北東
]);
```

##### clearTileCache

```typescript
async clearTileCache(nodeId: NodeId): Promise<void>
```

指定されたエンティティのタイルキャッシュをクリアします。

**パラメータ:**
- `nodeId`: エンティティのNodeId

**使用例:**
```typescript
await handler.clearTileCache('node-123' as NodeId);
```

##### findNearbyMaps

```typescript
async findNearbyMaps(
  center: [number, number], 
  radius: number
): Promise<BaseMapEntity[]>
```

指定された中心点から半径内にある地図を検索します。

**パラメータ:**
- `center`: 検索中心点 [longitude, latitude]
- `radius`: 検索半径（度単位）

**戻り値:**
見つかったBaseMapEntityの配列

**使用例:**
```typescript
const nearbyMaps = await handler.findNearbyMaps([139.6917, 35.6895], 0.1);
console.log(`Found ${nearbyMaps.length} maps nearby`);
```

## UI コンポーネント API

### BaseMapDialog

メインの地図作成・編集ダイアログコンポーネントです。

#### Props

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
```

#### 使用例

```typescript
import { BaseMapDialog } from '@hierarchidb/plugin-basemap';

function MyComponent() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [entity, setEntity] = useState<BaseMapEntity | undefined>();

  const handleSave = (data: Partial<BaseMapEntity>) => {
    // 保存処理
    console.log('Saving map data:', data);
    setDialogOpen(false);
  };

  return (
    <BaseMapDialog
      open={dialogOpen}
      entity={entity}
      onClose={() => setDialogOpen(false)}
      onSave={handleSave}
      mode={entity ? 'edit' : 'create'}
    />
  );
}
```

### BaseMapStepperDialog

4段階のステップ形式地図設定ダイアログです。

#### Props

```typescript
interface BaseMapStepperDialogProps extends BaseMapDialogProps {
  // BaseMapDialogPropsと同じ
}
```

#### Steps

1. **Basic Information**: 名前と説明
2. **Map Style**: スタイル選択とAPI設定
3. **View Settings**: 表示設定と座標
4. **Preview**: プレビューと最終確認

### ステップコンポーネント

#### Step1BasicInformation

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

#### Step2MapStyle

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

#### Step3MapView

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

#### Step4Preview

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

### BaseMapPreview

地図プレビューコンポーネントです。

#### Props

```typescript
interface BaseMapPreviewProps {
  config: Partial<BaseMapEntity>;
  width?: number | string;
  height?: number | string;
}
```

#### 使用例

```typescript
import { BaseMapPreview } from '@hierarchidb/plugin-basemap';

function MapPreviewExample() {
  const mapConfig = {
    mapStyle: 'satellite' as const,
    center: [139.6917, 35.6895] as [number, number],
    zoom: 12,
  };

  return (
    <BaseMapPreview
      config={mapConfig}
      width="100%"
      height={400}
    />
  );
}
```

## Worker API

Worker側で利用可能なAPI拡張メソッドです。

### exportMapStyle

```typescript
async exportMapStyle(nodeId: NodeId): Promise<MapLibreStyleConfig | undefined>
```

地図のスタイル設定をエクスポートします。

**使用例:**
```typescript
const styleConfig = await workerAPI.basemap.exportMapStyle('node-123' as NodeId);
if (styleConfig) {
  console.log('Exported style:', JSON.stringify(styleConfig, null, 2));
}
```

### importMapStyle

```typescript
async importMapStyle(nodeId: NodeId, styleConfig: MapLibreStyleConfig): Promise<void>
```

地図にスタイル設定をインポートします。

**使用例:**
```typescript
const styleConfig: MapLibreStyleConfig = {
  version: 8,
  sources: { /* ... */ },
  layers: [ /* ... */ ]
};

await workerAPI.basemap.importMapStyle('node-123' as NodeId, styleConfig);
```

### getMapBounds

```typescript
async getMapBounds(nodeId: NodeId): Promise<BaseMapEntity['bounds'] | undefined>
```

地図の境界設定を取得します。

**使用例:**
```typescript
const bounds = await workerAPI.basemap.getMapBounds('node-123' as NodeId);
if (bounds) {
  console.log('Map bounds:', bounds);
}
```

## データベース API

### BaseMapDatabase

BaseMapプラグイン専用のDexieデータベースクラスです。

#### メソッド

##### getInstance

```typescript
static getInstance(): BaseMapDatabase
```

シングルトンインスタンスを取得します。

##### cleanupExpiredEntries

```typescript
async cleanupExpiredEntries(): Promise<void>
```

期限切れのエントリをクリーンアップします。

**使用例:**
```typescript
const db = BaseMapDatabase.getInstance();
await db.cleanupExpiredEntries();
```

#### テーブル

##### basemaps

```typescript
basemaps: Table<BaseMapEntity>
```

メインのBaseMapエンティティテーブル。

**スキーマ:** `'&nodeId, mapStyle, updatedAt, createdAt'`

##### basemap_workingcopies

```typescript
basemap_workingcopies: Table<BaseMapWorkingCopy>
```

作業コピーテーブル（TTL: 24時間）。

**スキーマ:** `'&workingCopyId, workingCopyOf, copiedAt'`

##### basemap_tiles_cache

```typescript
basemap_tiles_cache: Table<TileCache>
```

タイルキャッシュテーブル（TTL: 1時間）。

**スキーマ:** `'&tileId, nodeId, zoom, x, y, cachedAt'`

## バリデーション API

### 座標バリデーション

```typescript
function validateCoordinates(center: [number, number]): boolean {
  const [lng, lat] = center;
  return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
}
```

### ズームレベルバリデーション

```typescript
function validateZoom(zoom: number): boolean {
  return zoom >= 0 && zoom <= 22;
}
```

### MapLibreスタイルバリデーション

```typescript
function validateMapLibreStyle(style: MapLibreStyleConfig): string[] {
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
}
```

## エラー型

### BaseMapError

```typescript
class BaseMapError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'BaseMapError';
  }
}
```

### 一般的なエラーコード

```typescript
enum BaseMapErrorCode {
  ENTITY_NOT_FOUND = 'ENTITY_NOT_FOUND',
  INVALID_COORDINATES = 'INVALID_COORDINATES',
  INVALID_ZOOM_LEVEL = 'INVALID_ZOOM_LEVEL',
  INVALID_STYLE_CONFIG = 'INVALID_STYLE_CONFIG',
  VERSION_CONFLICT = 'VERSION_CONFLICT',
  DATABASE_ERROR = 'DATABASE_ERROR',
  TILE_CACHE_ERROR = 'TILE_CACHE_ERROR',
  API_KEY_INVALID = 'API_KEY_INVALID',
}
```

## 定数とプリセット

### デフォルト設定

```typescript
export const DEFAULT_MAP_CONFIG: Partial<BaseMapEntity> = {
  mapStyle: 'streets',
  center: [0, 0],
  zoom: 10,
  bearing: 0,
  pitch: 0,
  displayOptions: {
    show3dBuildings: false,
    showTraffic: false,
    showTransit: false,
    showTerrain: false,
    showLabels: true,
  },
};
```

### 地図スタイルプリセット

```typescript
export const MAP_STYLE_PRESETS: Record<string, Partial<MapLibreStyleConfig>> = {
  streets: {
    version: 8,
    name: 'Streets',
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors',
      },
    },
    layers: [
      {
        id: 'osm',
        type: 'raster',
        source: 'osm',
      },
    ],
  },
  satellite: {
    version: 8,
    name: 'Satellite',
    sources: {
      satellite: {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        attribution: '© Esri',
      },
    },
    layers: [
      {
        id: 'satellite',
        type: 'raster',
        source: 'satellite',
      },
    ],
  },
};
```

## 使用例

### 基本的な使用パターン

#### 1. 新しい地図の作成

```typescript
import { BaseMapEntityHandler } from '@hierarchidb/plugin-basemap';

async function createNewMap() {
  const handler = new BaseMapEntityHandler();
  
  const entity = await handler.createEntity(
    'node-123' as NodeId,
    {
      name: 'Tokyo Map',
      mapStyle: 'satellite',
      center: [139.6917, 35.6895],
      zoom: 12,
      displayOptions: {
        show3dBuildings: true,
        showLabels: true,
      },
    }
  );
  
  console.log('Created map:', entity);
}
```

#### 2. 作業コピーでの編集

```typescript
async function editMapWithWorkingCopy(nodeId: NodeId) {
  const handler = new BaseMapEntityHandler();
  
  // 作業コピー作成
  const workingCopy = await handler.createWorkingCopy(nodeId);
  
  // 編集
  workingCopy.zoom = 15;
  workingCopy.center = [139.7, 35.7];
  workingCopy.isDirty = true;
  
  // コミット
  await handler.commitWorkingCopy(nodeId, workingCopy);
}
```

#### 3. カスタムスタイルの設定

```typescript
async function setCustomStyle(nodeId: NodeId) {
  const handler = new BaseMapEntityHandler();
  
  const customStyle: MapLibreStyleConfig = {
    version: 8,
    sources: {
      'my-tiles': {
        type: 'raster',
        tiles: ['https://example.com/tiles/{z}/{x}/{y}.png'],
        tileSize: 256,
      },
    },
    layers: [
      {
        id: 'my-layer',
        type: 'raster',
        source: 'my-tiles',
      },
    ],
  };
  
  await handler.updateEntity(nodeId, {
    mapStyle: 'custom',
    styleConfig: customStyle,
  });
}
```

このAPIリファレンスにより、BaseMapプラグインの全機能を効率的に活用できます。