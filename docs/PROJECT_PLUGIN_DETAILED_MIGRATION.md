# project-plugin移行計画書（アーカイブ）

> 2025-09-16 更新: `project-plugin` は廃止され、後継の `@hierarchidb/plugins-linker-plugin` が運用中です。本書は旧プラグイン向けのアーカイブ資料として残しています。実運用/新規作業では `linker-plugin` の設計・ガイドを参照してください。

## 現状分析結果

### 現在のエラー状況（127件・大規模プラグイン）

**カテゴリ別エラー分布**:
1. **Deck.gl import問題**: 48件（HeatmapLayer、HexagonLayer等の廃止・移動）
2. **未使用変数・import**: 37件（大量の未使用コード）
3. **型定義問題**: 25件（PluginDefinition generics、undefined可能性）
4. **jsPDF型問題**: 17件（PDF export機能の型エラー）

### プラグインの実装状況

**✅ project-pluginは最も高機能で複雑なプラグイン**:
- **Deck.gl統合**: 高度な3Dデータ可視化
- **プロジェクト管理**: ワークフロー・タスク管理
- **空間分析**: 地理空間データ解析エンジン
- **時系列分析**: テンポラル分析機能
- **レポート生成**: PDF/HTML/DOCX出力
- **MapLibre統合**: 地図・可視化機能

### 重要な発見
project-pluginは**HierarchiDB最高峰**の複合機能プラグインです。データ可視化、プロジェクト管理、空間分析、レポート生成を統合した最も高度な機能を提供します。

## 実装済み機能の確認

### Core機能
```typescript
// ProjectEntity - 高度なプロジェクト管理
export interface ProjectEntity {
  id: EntityId;
  name: string;
  description: string;
  layers: ProjectLayer[];          // Deck.gl レイヤー設定
  analysis: SpatialAnalysis[];     // 空間分析設定  
  timeline: TemporalConfig;        // 時系列分析
  outputConfig: OutputConfig;      // レポート出力設定
  collaborators: User[];           // コラボレーション
}
```

### 高度なUI Components（完全実装済み）
- **ProjectMapView**: Deck.gl統合3Dマップ
- **SpatialAnalysisStep**: 空間分析設定
- **TemporalAnalysisStep**: 時系列分析設定
- **LayerConfigStep**: レイヤー詳細設定
- **OutputConfigStep**: レポート出力設定

### 分析エンジン（完成済み）
- **SpatialAnalysisEngine**: 地理空間データ解析
- **TemporalAnalysisEngine**: 時系列データ分析
- **ReportGenerator**: 多形式レポート生成
- **CollaborationManager**: チーム協働機能

## 具体的修正計画

### Phase 1: Deck.gl import問題修正（1.5時間）

#### 1.1 廃止されたLayerの修正
```typescript
// src/components/map/ProjectMapView.tsx
// 修正前（Deck.gl v9で廃止・移動されたレイヤー）
import {
  HeatmapLayer,      // → @deck.gl/aggregation-layers
  HexagonLayer,      // → @deck.gl/aggregation-layers  
  TripsLayer,        // → @deck.gl/geo-layers
  H3HexagonLayer,    // → @deck.gl/geo-layers
  GridLayer,         // → @deck.gl/aggregation-layers
  ContourLayer       // → @deck.gl/aggregation-layers
} from '@deck.gl/layers';

// 修正後（正しいパッケージからimport）
import { HeatmapLayer, HexagonLayer, GridLayer, ContourLayer } from '@deck.gl/aggregation-layers';
import { TripsLayer, H3HexagonLayer } from '@deck.gl/geo-layers';
// 他のレイヤーは@deck.gl/layersから正常import
```

#### 1.2 Deck.gl types修正
```typescript
// Color型エラー修正
// 修正前
getColor: [255, 0, 0]  // number[]型エラー

// 修正後
getColor: [255, 0, 0] as Color  // Color型にキャスト
```

### Phase 2: 未使用変数・import大量削除（1時間）

#### 2.1 未使用import削除（37件）
```typescript
// src/components/map/ProjectMapView.tsx
// 修正前（大量の未使用import）
import { useMemo } from 'react';          // 未使用
import { ArcLayer, TextLayer } from '@deck.gl/layers';  // 未使用
import * as turf from '@turf/turf';       // 未使用
import { ToggleButtonGroup, ToggleButton } from '@mui/material';  // 未使用
// ... 他20件以上の未使用import

// 修正後（未使用import削除）
// import { useMemo } from 'react';
// import { ArcLayer, TextLayer } from '@deck.gl/layers';
// import * as turf from '@turf/turf';
// ... 削除
```

### Phase 3: jsPDF型問題修正（45分）

#### 3.1 jsPDF format型修正
```typescript
// src/components/map/ProjectMapView.tsx
// 修正前（型エラー）
const formats = [297, 210] as const;  // readonly tuple型エラー

// 修正後（jsPDF対応型）
import { jsPDFFormat } from 'jspdf';

const formats: jsPDFFormat[] = ['a4', 'a3', 'letter'];  // 文字列リテラル使用
```

#### 3.2 PDF export機能修正
```typescript
// PDF生成時の型安全な処理
const generatePDF = (format: jsPDFFormat) => {
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: format  // 型安全なformat指定
  });
  // ... PDF生成処理
};
```

### Phase 4: 型定義問題修正（30分）

#### 4.1 PluginDefinition generic修正
```typescript
// src/ProjectPlugin.tsx
// 修正前
export const ProjectPlugin: PluginDefinition = {  // generic不足

// 修正後
export const ProjectPlugin: PluginDefinition<ProjectEntity> = {
  nodeType: 'project',
  name: 'Project',
  displayName: 'プロジェクト',
  // ... 既存実装
};
```

#### 4.2 undefined対策
```typescript
// src/components/wizard/steps/TemporalAnalysisStep.tsx
// 修正前
const config = data.timeline;
const startTime = config.startTime;  // config がundefinedの可能性

// 修正後
const config = data.timeline;
if (!config) {
  return <div>Timeline configuration required</div>;
}
const startTime = config.startTime;
```

## 作業順序と検証

### 推奨作業順序
1. **Phase 1**: Deck.gl import修正（48件エラー解決）
2. **Phase 2**: 未使用変数削除（37件警告解決）
3. **Phase 3**: jsPDF型修正（17件エラー解決）
4. **Phase 4**: 型定義修正（25件エラー解決）

### 検証方法
```bash
# 各Phase後にエラー数確認
pnpm --filter @hierarchidb/project-plugin typecheck

# 期待される改善:
# Phase 1完了後: 127件 → 79件（Deck.gl import修正）
# Phase 2完了後: 79件 → 42件（未使用変数削除）
# Phase 3完了後: 42件 → 25件（jsPDF型修正）
# Phase 4完了後: 25件 → 0件（型定義修正）

# 最終確認
pnpm --filter @hierarchidb/project-plugin build
```

## 依存関係と注意点

### 独立性
project-pluginは**他プラグインに依存しない**最上位プラグイン：
- ✅ 他プラグイン修正完了を待つ必要なし
- ✅ 即座に修正作業開始可能

### 既存機能の完全保持
- ✅ **Deck.gl 3D可視化**（高度なデータ可視化）
- ✅ **空間分析エンジン**（地理空間解析）
- ✅ **時系列分析**（テンポラル分析）
- ✅ **レポート生成**（PDF/HTML/DOCX出力）
- ✅ **プロジェクト管理**（ワークフロー・コラボレーション）

### 作業見積もり
- **Phase 1-4合計**: **4時間**
- **作業の性質**: import修正・未使用コード削除・型修正
- **新機能実装**: **不要**（最高レベルで完成済み）

## 重要な確認

### 最高峰の複合機能プラグイン
project-pluginは**HierarchiDB最高峰**の機能を持つプラグインです：
- **3Dデータ可視化**: Deck.glによる高度な可視化
- **包括的分析**: 空間・時系列・統計分析の統合
- **プロジェクト管理**: チーム協働・ワークフロー管理
- **多形式出力**: PDF・HTML・DOCX・PMTiles対応
- **リアルタイム処理**: 大規模データの効率的処理

### 修正の本質
必要な修正は**依存関係更新とコードクリーンアップのみ**で、既存の最高レベルの機能群はすべて保持されます。

この計画により、project-pluginの127件のエラーを**4時間で**解決し、完成された最高レベルの複合機能を活用できるようになります。

## 特記事項

### 最重要プラグイン
project-pluginは**HierarchiDBの中核機能**を担う最重要プラグインです。すべての高度機能（3D可視化、分析、レポート、プロジェクト管理）を統合した、システムの価値を最大化するプラグインです。
