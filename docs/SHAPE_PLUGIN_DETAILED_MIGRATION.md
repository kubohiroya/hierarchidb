# shape-plugin移行計画書

## 現状分析結果

### 現在のエラー状況（11件）

**カテゴリ別エラー分布**:
1. **構文エラー**: 8件（category-types.tsのJSX構文エラー）
2. **未使用変数**: 3件（テスト内の未使用変数警告）

### プラグインの実装状況

**✅ shape-pluginは非常に完成度が高いプラグイン**:
- **folder-plugin拡張**: FolderEntityを継承した地理空間データプラグイン
- **完全なStep実装**: DataSourceStep, LicenseStep, ProcessingStep, CountrySelectionStep
- **高度なバッチ処理**: 大規模地理データの並列処理
- **Worker統合**: VectorTileWorker、SimplifyWorker、DownloadWorker
- **認証システム**: データソースアクセス認証
- **エラーハンドリング**: 包括的なエラー管理システム

### 重要な発見
shape-pluginは**HierarchiDBで最も高度**なプラグインの一つです。地理空間データの取得・処理・可視化を包括的に扱い、大規模データのバッチ処理機能を持ちます。

## 実装済み機能の確認

### Core機能
```typescript
// ShapeEntity - FolderEntityを拡張
export interface ShapeEntity extends FolderEntity {
  dataSourceName: string;           // 地理データソース
  selectedCountries: string[];      // 選択国家
  selectedAdminLevels: number[];    // 行政区画レベル
  licenseAgreement: boolean;        // ライセンス同意
  batchConfig?: BatchConfig;        // バッチ処理設定
}
```

### UI Components（完全実装済み）
- **DataSourceStep**: データソース選択（geofabrik、naturalearth、gadm、osm）
- **LicenseStep**: ライセンス同意確認
- **ProcessingStep**: 処理設定（行政レベル選択）
- **CountrySelectionStep**: 国家選択インターフェース

### バッチ処理システム（完成済み）
- **BatchSessionManager**: セッション管理
- **WorkerPoolManager**: ワーカープール管理
- **VectorTileService**: ベクタタイル生成
- **ShapeService**: 地理データ処理サービス

### データベース統合（完成済み）
- **ShapeDB**: Dexieベースの永続化
- **EphemeralShapeDB**: 一時データ管理
- **Working Copy**: 編集中データの管理

## 具体的修正計画

### Phase 1: 構文エラー修正（15分）

#### 1.1 category-types.tsのJSX構文修正
```typescript
// src/types/category-lifecycle-types.ts
// 修正前（構文エラー）
export const SHAPE_CATEGORIES: CategoryOption<ShapeCategory>[] = [
  {
    value: 'geographic',
    label: '地理的境界',
    description: '国境、海岸線、山脈などの自然地理境界',
    icon: <Map />,          // ← JSX構文エラー
    color: '#2196f3'
  },
  // ... 他のカテゴリも同様
];

// 修正後（文字列参照に変更）
export const SHAPE_CATEGORIES: CategoryOption<ShapeCategory>[] = [
  {
    value: 'geographic',
    label: '地理的境界',
    description: '国境、海岸線、山脈などの自然地理境界',
    icon: 'map',           // ← 文字列に変更
    color: '#2196f3'
  },
  {
    value: 'administrative',
    label: '行政境界',
    description: '都道府県、市区町村などの行政区画',
    icon: 'account-balance',
    color: '#ff9800'
  },
  {
    value: 'environmental',
    label: '環境データ',
    description: '気候区分、生態系、汚染状況などの環境情報',
    icon: 'terrain',
    color: '#4caf50'
  },
  {
    value: 'economic',
    label: '経済データ',
    description: '産業地域、経済圏、商圏などの経済活動エリア',
    icon: 'business',
    color: '#9c27b0'
  }
];
```

### Phase 2: 未使用変数クリーンアップ（10分）

#### 2.1 テスト内の未使用変数削除
```typescript
// src/__tests__/colorUtils.test.ts
// 修正前
const { h3 } = result;  // 未使用変数

// 修正後
// const { h3 } = result;  // 削除またはコメントアウト
```

### Phase 3: 既存機能の確認・保持（変更なし）

#### 3.1 完成された機能の確認
- ✅ **地理データ取得**: 複数ソース対応（Geofabrik、Natural Earth等）
- ✅ **大規模バッチ処理**: 並列処理・プログレス表示
- ✅ **ベクタタイル生成**: MapLibre統合対応
- ✅ **エラー処理**: 包括的エラーハンドリング
- ✅ **認証システム**: データソースアクセス管理
- ✅ **作業継続機能**: セッション管理・リカバリ

## 作業順序と検証

### 推奨作業順序
1. **Phase 1**: 構文エラー修正（即座に8件エラー解決）
2. **Phase 2**: 未使用変数クリーンアップ（3件警告解決）

### 検証方法
```bash
# Phase 1後にエラー数確認
pnpm --filter @hierarchidb/node-type-shape-plugin typecheck

# 期待される改善:
# Phase 1完了後: 11件 → 3件（構文エラー修正）
# Phase 2完了後: 3件 → 0件（未使用変数クリーンアップ）

# 最終確認
pnpm --filter @hierarchidb/node-type-shape-plugin build
```

## 依存関係と注意点

### folder-plugin依存
shape-pluginは**folder-pluginを拡張**するため：
- ✅ folder-pluginの修正完了が前提
- ✅ FolderEntityが正常動作している必要

### 既存機能の完全保持
- ✅ **全ての高度機能を保持**（バッチ処理、Worker、認証）
- ✅ **UI Components**（完全実装済み）
- ✅ **データベース統合**（ShapeDB、EphemeralShapeDB）
- ✅ **Working Copy機能**（編集セッション管理）

### 作業見積もり
- **Phase 1-2合計**: **25分**
- **作業の性質**: 構文修正とクリーンアップのみ
- **新機能実装**: **不要**（完全に完成済み）

## 重要な確認

### 最高レベルの完成度
shape-pluginは**HierarchiDB最高レベル**の完成度を持つプラグインです：
- **地理空間データ処理**: OSM、Natural Earth、GADMデータ対応
- **大規模バッチ処理**: 並列処理・進捗管理
- **ベクタタイル生成**: MapLibre統合
- **包括的エラーハンドリング**: 段階的エラー回復
- **認証システム**: セキュアなデータアクセス
- **Worker統合**: バックグラウンド処理

### 修正の本質
必要な修正は**構文エラーの修正のみ**で、既存の非常に高度な地理空間データ処理機能はすべて保持されます。

この計画により、shape-pluginの11件のエラーを**25分で**解決し、完成された高度な地理空間データ処理機能を活用できるようになります。