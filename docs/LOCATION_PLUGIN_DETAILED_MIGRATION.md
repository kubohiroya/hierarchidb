# location-plugin移行計画書

## 現状分析結果

### 現在のエラー状況（65件）

**カテゴリ別エラー分布**:
1. **Material-UI Grid props**: 41件（item, xs, md propsエラー）
2. **Entity/Handler型定義**: 12件（BaseEntityHandler継承問題）
3. **NodeId型問題**: 8件（nodeIdフィールド存在しない問題）
4. **未定義型参照**: 4件（MetadataSearchCriteria等）

### プラグインの実装状況

**✅ location-pluginは高度な位置情報管理プラグイン**:
- **BaseEntityHandler拡張**: 地理座標・住所管理機能
- **バッチ処理機能**: 大量位置データの処理
- **UI Components**: LocationSelectionStep、BatchProgressDialog
- **地理空間検索**: 範囲検索・近接検索機能
- **データインポート**: CSV/JSON形式の位置データ取り込み

### 重要な発見
location-pluginは**MetadataEntityHandlerベース**の位置情報管理プラグインです。地理座標、住所情報、カテゴリ管理を包括的に行います。

## 実装済み機能の確認

### Core機能
```typescript
// LocationEntity - BaseEntityHandlerベース
export interface LocationEntity {
  id: EntityId;
  name: string;
  description: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  category: LocationCategory;
}
```

### UI Components（実装済み）
- **LocationSelectionStep**: 位置選択・住所入力
- **BatchProgressDialog**: バッチ処理進捗表示
- **LocationDialog**: 位置情報編集ダイアログ

### 地理空間機能（完成済み）
- **座標管理**: 緯度経度・住所の相互変換
- **範囲検索**: 指定範囲内の位置検索
- **近接検索**: 指定地点からの距離ベース検索
- **バッチ処理**: CSV/JSONからの一括取り込み

## 具体的修正計画

### Phase 1: Material-UI Grid props修正（1時間）

#### 1.1 Grid component props修正
```typescript
// src/components/batch/BatchProgressDialog.tsx
// 修正前（MUI v6でitem propが削除された）
<Grid xs={6} md={3}>
  <Paper>Content</Paper>
</Grid>

// 修正後（MUI v7: Grid を使用）
import Grid from '@mui/material/Grid';

<Grid xs={6} md={3}>
  <Paper>Content</Paper>
</Grid>

// または従来のFlexbox使用
<Box sx={{ 
  display: 'grid', 
  gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
  gap: 2 
}}>
  <Paper>Content</Paper>
</Box>
```

#### 1.2 全Grid使用箇所の修正
```bash
# 対象ファイル（一括修正）
src/components/batch/BatchProgressDialog.tsx (20箇所)
src/components/steps/LocationSelectionStep.tsx (21箇所)
```

### Phase 2: Entity/Handler型定義修正（45分）

#### 2.1 BaseEntityHandler継承修正
```typescript
// src/entities/LocationEntityHandler.ts
// 修正前（型制約エラー）
export class LocationEntityHandler extends BaseEntityHandler<
  LocationEntity,
  LocationWorkingCopy,        // ← WorkingCopy制約違反
  CreateLocationData,
  LocationFilterCriteria
> {

// 修正後（正しいWorkingCopy型）
export interface LocationWorkingCopy extends LocationEntity, WorkingCopyProperties {
  isDraft: boolean;
  originalId?: EntityId;
  copiedAt: number;
}

export class LocationEntityHandler extends BaseEntityHandler<
  LocationEntity,
  LocationWorkingCopy,
  CreateLocationData,
  LocationFilterCriteria
> {
```

#### 2.2 table型定義修正
```typescript
// src/entities/LocationEntityHandler.ts
// 修正前
public table: Table<LocationEntity, EntityId>;

// 修正後（bulkUpdateメソッド対応）
public table: Table<LocationEntity, EntityId, LocationEntity>;
```

### Phase 3: NodeId型問題修正（30分）

#### 3.1 nodeIdフィールドの除去
```typescript
// src/entities/LocationEntityHandler.ts
// 修正前（nodeIdフィールドエラー）
const entity: LocationEntity = {
  nodeId,           // ← LocationEntityにnodeIdフィールドは存在しない
  name: data.name,
  // ... 他のフィールド
};

// 修正後（nodeIdフィールド除去）
const entity: LocationEntity = {
  name: data.name,
  description: data.description || '',
  coordinates: data.coordinates,
  address: data.address,
  category: data.category,
  // ... 他の正しいフィールド
};
```

### Phase 4: 未定義型参照修正（15分）

#### 4.1 MetadataSearchCriteria型定義追加
```typescript
// src/entities/LocationEntity.ts
// 修正前（未定義型参照）
export interface LocationFilterCriteria extends MetadataSearchCriteria {
  // ...
}

// 修正後（型定義追加または削除）
export interface MetadataSearchCriteria {
  searchText?: string;
  tags?: string[];
  category?: string;
}

export interface LocationFilterCriteria extends MetadataSearchCriteria {
  coordinates?: {
    center: [number, number];
    radius: number;
  };
  category?: LocationCategory;
}
```

## 作業順序と検証

### 推奨作業順序
1. **Phase 1**: Grid props修正（41件エラー解決）
2. **Phase 2**: Entity/Handler型定義修正（12件エラー解決）
3. **Phase 3**: NodeId型問題修正（8件エラー解決）
4. **Phase 4**: 未定義型参照修正（4件エラー解決）

### 検証方法
```bash
# 各Phase後にエラー数確認
pnpm --filter @hierarchidb/plugin-loader-location-plugin typecheck

# 期待される改善:
# Phase 1完了後: 65件 → 24件（Grid props修正）
# Phase 2完了後: 24件 → 12件（Handler型定義修正）
# Phase 3完了後: 12件 → 4件（NodeId問題修正）
# Phase 4完了後: 4件 → 0件（未定義型修正）

# 最終確認
pnpm --filter @hierarchidb/plugin-loader-location-plugin stage
```

## 依存関係と注意点

### base-plugin依存
location-pluginは**base-pluginを使用**するため：
- ✅ base-pluginの修正完了が前提
- ✅ BaseEntityHandlerが正常動作している必要

### 既存機能の保持
- ✅ **位置情報管理機能**（座標・住所）
- ✅ **地理空間検索**（範囲・近接検索）
- ✅ **バッチ処理**（CSV/JSON取り込み）
- ✅ **UI Components**（LocationSelectionStep等）

### 作業見積もり
- **Phase 1-4合計**: **2.5時間**
- **作業の性質**: UI props修正と型定義調整
- **新機能実装**: **不要**（完成済み機能を保持）

## 重要な確認

### 高度な位置情報管理プラグイン
location-pluginは**高度な位置情報管理機能**を持つプラグインです：
- **地理座標管理**: 緯度経度・住所の統合管理
- **地理空間検索**: 範囲検索・近接検索
- **バッチ処理**: 大量位置データの効率的処理
- **UI統合**: 直感的な位置選択・編集インターフェース

### 修正の本質
必要な修正は**Material-UI v6対応と型定義調整のみ**で、既存の高度な位置情報管理機能はすべて保持されます。

この計画により、location-pluginの65件のエラーを**2.5時間で**解決し、完成された位置情報管理機能を活用できるようになります。
