# styler-plugin移行計画書

## 現状分析結果

### 現在のエラー状況（141件）

**カテゴリ別エラー分布**:
1. **provider-i18next問題**: 47件（react-i18nextへの変更が必要）
2. **依存関係参照**: 38件（folder-plugin、spreadsheet-plugin依存問題）  
3. **ui-csv-extract問題**: 35件（存在しないパッケージ参照）
4. **型の不整合**: 21件（any型、undefined可能性、テスト型定義不備）

### プラグインの実装状況

**✅ styler-pluginは完成されたプラグイン**:
- **spreadsheet-plugin拡張**: SpreadsheetEntityを継承してStylerEntity定義
- **Step5-6追加実装**: StylerStep5（スタイル設定）、StylerStep6（プレビュー）
- **MapLibre統合**: カラーマッピング機能、スタイル仕様生成
- **高度な機能**: 統計分析、カラーグラデーション、データ可視化
- **完全なUI**: StylerConfiguration、StylerTablePreview

### 重要な発見
styler-pluginは**spreadsheet-pluginを拡張**した高度なデータ可視化プラグインです。CSV/Excelデータから自動的にMapLibreスタイル仕様を生成する機能を持ちます。

## 実装済み機能の確認

### Core機能
```typescript
// StylerEntity - SpreadsheetEntityを拡張
export interface StylerEntity extends SpreadsheetEntity, StylerExtendedFields {
  stylerConfig: StylerConfig;
  selectedKeyColumn?: string;
  selectedValueColumn?: string;
  generatedStyle?: {
    maplibreStyleSpec: any;
    colorMapping: Record<string, string>;
    lastUpdated: number;
  };
}
```

### UI Components（実装済み）
- **StylerStep5**: カラーマッピング設定、データ統計分析
- **StylerStep6**: プレビュー機能、MapLibreスタイル確認
- **StylerConfiguration**: 詳細スタイル設定
- **StylerTablePreview**: データテーブルプレビュー

### データ処理機能（完成済み）
- **統計分析**: 最大値・最小値・四分位数の自動計算
- **カラーグラデーション**: 自動色分け生成
- **MapLibre統合**: スタイル仕様の自動生成
- **バリデーション**: データ範囲・カラーマッピングの妥当性チェック

## 具体的修正計画

### Phase 1: i18next参照修正（30分）

#### 1.1 provider-i18next → react-i18next修正
```typescript
// src/steps/BasicInfoStep.tsx
// 修正前
import { useTranslation } from 'provider-i18next';

// 修正後  
import { useTranslation } from 'react-i18next';

// 使用方法は変更なし
const { t } = useTranslation('styler-plugin');
```

#### 1.2 全コンポーネントの同様修正
```bash
# 対象ファイル（一括修正）
src/steps/BasicInfoStep.tsx
src/components/steps/StylerStep5.tsx
src/components/steps/StylerStep6.tsx
```

### Phase 2: 依存関係参照修正（folder-plugin、spreadsheet-plugin修正後）

#### 2.1 folder-plugin参照の修正
```typescript
// src/extensions/StylerDialogExtension.tsx
// 修正前（エラーの原因）
import { FolderEntityHandler } from '@hierarchidb/plugin-loader-folder-plugin';

// 修正後（folder-plugin修正完了後）
import { FolderEntityHandler } from '@hierarchidb/plugin-loader-folder-plugin';
// 変更なし - folder-pluginの修正完了を待つ
```

#### 2.2 spreadsheet-plugin参照の修正
```typescript
// src/services/RuntimeWorkerService.ts
// 修正前（エラーの原因）
import { SpreadsheetEntityHandler } from '@hierarchidb/plugin-loader-spreadsheet-plugin';

// 修正後（spreadsheet-plugin修正完了後）
import { SpreadsheetEntityHandler } from '@hierarchidb/plugin-loader-spreadsheet-plugin';
// 変更なし - spreadsheet-pluginの修正完了を待つ
```

### Phase 3: ui-csv-extract代替実装（1時間）

#### 3.1 @hierarchidb/ui-csv-extract代替
**現状**: 存在しないパッケージに依存

**対応**: 既存のCSV処理機能を統合
```typescript
// src/services/StylerCSVProcessor.ts（新規作成）
export class StylerCSVProcessor {
  async parseCSVForStylerping(file: File): Promise<StylerData> {
    const text = await file.text();
    const lines = text.split('\n');
    const headers = lines[0].split(',');
    const rows = lines.slice(1).map(line => line.split(','));
    
    // 統計分析機能（既存のutils/dataAnalysis.tsを活用）
    const statistics = this.calculateStatistics(rows, headers);
    
    return {
      headers,
      rows,
      statistics,
      columnCount: headers.length,
      rowCount: rows.length
    };
  }
  
  private calculateStatistics(rows: string[][], headers: string[]) {
    // 既存のutils/dataAnalysis.tsの機能を統合
  }
}
```

#### 3.2 ImportとService統合
```typescript
// src/services/StylerDataService.ts
// 修正前
import { CSVProcessor } from '@hierarchidb/ui-tabular-extract';

// 修正後
import { StylerCSVProcessor } from './StylerCSVProcessor';

// 使用箇所も対応するメソッド名に変更
```

### Phase 4: 型安全性向上（45分）

#### 4.1 テスト型定義の修正
```typescript
// src/__tests__/csvParser.test.ts
// 修正前（テスト型定義不備）
describe('CSV Parser Tests', () => {
  // test実装
});

// 修正後（Vitest型定義追加）
import { describe, it, expect } from 'vitest';

describe('CSV Parser Tests', () => {
  //...
});
  // 既存テスト実装を維持
```

#### 4.2 undefined対策
```typescript
// src/utils/dataAnalysis.ts
// 修正前（undefined可能性）
const result = {
  min: stats.min,     // 未定義の可能性
  max: stats.max,     // 未定義の可能性
  q1: stats.q1,       // 未定義の可能性
  q3: stats.q3        // 未定義の可能性
};

// 修正後（安全な処理）
const result = {
  min: stats.min ?? 0,
  max: stats.max ?? 0,
  q1: stats.q1 ?? 0,
  q3: stats.q3 ?? 0
};
```

### Phase 5: NodeType型修正（15分）

#### 5.1 branded type対応
```typescript
// src/shared/metadata.ts
// 修正前
nodeType: 'styler'  // string型エラー

// 修正後
nodeType: 'styler' as NodeType  // branded type cast
```

## 作業順序と検証

### 推奨作業順序（依存関係考慮）
1. **Phase 1**: i18next修正（即座に47件エラー減少）
2. **Phase 4**: 型安全性向上（21件エラー解決）
3. **Phase 5**: NodeType修正（1件エラー解決）
4. **Phase 3**: CSV処理統合（35件エラー解決）
5. **Phase 2**: 依存関係修正（folder/spreadsheet-plugin修正後）

### 検証方法
```bash
# 各Phase後にエラー数確認
pnpm --filter @hierarchidb/plugin-loader-styler-plugin typecheck

# 期待される改善:
# Phase 1完了後: 141件 → 94件（i18next修正）
# Phase 4完了後: 94件 → 73件（型安全性向上）
# Phase 5完了後: 73件 → 72件（NodeType修正）
# Phase 3完了後: 72件 → 37件（CSV処理統合）
# Phase 2完了後: 37件 → 10件以下（依存関係解決）

# 最終確認
pnpm --filter @hierarchidb/plugin-loader-styler-plugin build
```

## 依存関係と注意点

### spreadsheet-plugin依存（重要）
styler-pluginは**spreadsheet-pluginを拡張**するため：
- ✅ **spreadsheet-pluginの修正完了が前提**
- ✅ **SpreadsheetEntity**が正常動作している必要
- ✅ **CSV処理機能**との統合が必要

### 既存機能の完全保持
- ✅ **MapLibre統合**（スタイル仕様生成）
- ✅ **統計分析機能**（データ分析）
- ✅ **カラーマッピング**（グラデーション生成）
- ✅ **プレビュー機能**（リアルタイム確認）
- ✅ **バリデーション**（データ妥当性チェック）

### 作業見積もり
- **Phase 1, 4, 5**: **1.5時間**（独立実行可能）
- **Phase 3**: **1時間**（CSV処理統合）
- **Phase 2**: **30分**（folder/spreadsheet-plugin修正後）
- **合計**: **3時間**

## 重要な確認

### 完成度の高いプラグイン
styler-pluginは以下の高度な機能を持つ**完成されたプラグイン**です：
- **データ可視化**: CSVからMapLibreスタイル自動生成
- **統計分析**: 最大・最小・四分位数の自動計算
- **カラーマッピング**: データ値に基づく色分け
- **リアルタイムプレビュー**: スタイル確認機能
- **バリデーション完備**: データ範囲・設定妥当性チェック

### 修正の本質
必要な修正は**依存関係とImport調整のみ**で、既存の豊富なデータ可視化機能はすべて保持されます。

この計画により、styler-pluginの141件のエラーを**3時間で**解決し、完成されたデータ可視化機能を活用できるようになります。
