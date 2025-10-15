# 修正版プラグイン移行指示書

## 🚨 重要な訂正

**以前の分析は根本的に間違っていました**。各プラグインは既に完成されており、必要なのは**アーキテクチャ移行に伴う型参照の修正のみ**です。

## 実際の現状

### spreadsheet-plugin
- ✅ **実装状況**: 完成済み（FolderEntity拡張パターン）
- ✅ **主要機能**: CSV/Excel処理、データフィルタリング、バリデーション
- ✅ **UI コンポーネント**: DataSourceStep, FilteringStep
- ❌ **問題**: 型参照のみ（`@hierarchidb/folder-plugin`等）

### basemap-plugin  
- ✅ **実装状況**: 完成済み（FolderEntity拡張パターン）
- ✅ **主要機能**: マップスタイル、ビューポート設定、表示オプション
- ✅ **UI コンポーネント**: MapStyleStep, MapViewportStep, DisplayOptionsStep, PreviewStep
- ❌ **問題**: 型名の不一致（`ExtendableNodeTypeDefinition` → `ExtendingNodeTypeDefinition`）

### styler-plugin
- ✅ **実装状況**: 完成済み（SpreadsheetEntity拡張パターン）
- ✅ **主要機能**: データ駆動型スタイルマッピング、色彩管理
- ✅ **UI コンポーネント**: StylerStep5, StylerStep6
- ❌ **問題**: 依存関係参照の修正

## 正しい修正方針

### Phase 1: Import/Export の修正（1-2時間）

#### spreadsheet-plugin修正
```typescript
// src/extension/definition.ts
// 修正前
import type { FolderEntity } from '@hierarchidb/plugin-loader-folder-plugin';

// 修正後  
import type { FolderEntity } from '@hierarchidb/plugin-loader-folder-plugin';
// または、新アーキテクチャでの正しい参照先に変更
```

#### basemap-plugin修正
```typescript
// src/definitions/BaseMapPluginDefinition.ts
// 修正前
import type { ExtendableNodeTypeDefinition } from '@hierarchidb/common-type';

// 修正後
import type { ExtendingNodeTypeDefinition } from '@hierarchidb/common-type';

export const BaseMapPluginDefinition: ExtendingNodeTypeDefinition<
  FolderEntity,
  BaseMapEntity,
  BaseMapWorkingCopy
> = {
  // 実装は既に完成済み、型名のみ修正
```

#### styler-plugin修正
```typescript
// 依存関係の正しい参照に修正
// 既存の機能実装は完全に保持
```

### Phase 2: Package.json 依存関係修正（30分）

```json
// 各プラグインの package.json
{
  "dependencies": {
    "@hierarchidb/common-type": "workspace:*",
    "@hierarchidb/common-api": "workspace:*",
    "@hierarchidb/base-plugin": "workspace:*",  // 追加
    "@hierarchidb/folder-plugin": "workspace:*", // 既存維持
    // その他は既存のまま保持
  }
}
```

### Phase 3: 型チェック・ビルド確認（30分）

```bash
# 各プラグインで実行
pnpm typecheck
pnpm build

# 期待結果: エラー大幅減少（既存機能は動作）
```

## 作業見積もりの修正

### 以前の誤った見積もり
- ❌ **spreadsheet-plugin**: 3-4日
- ❌ **basemap-plugin**: 1日  
- ❌ **styler-plugin**: 2日
- ❌ **合計**: 6-7日

### 正しい見積もり
- ✅ **spreadsheet-plugin**: 1-2時間
- ✅ **basemap-plugin**: 1時間
- ✅ **styler-plugin**: 1-2時間  
- ✅ **合計**: 3-5時間

## 重要な方針転換

### やらない事（以前の誤った方針）
- ❌ 既存機能の再実装
- ❌ 新しいEntity定義の作成
- ❌ Database構造の変更
- ❌ UI コンポーネントの再作成

### やる事（正しい方針）
- ✅ Import/Export 文の修正
- ✅ 型名の修正（ExtendableNodeTypeDefinition → ExtendingNodeTypeDefinition）
- ✅ Package依存関係の微調整
- ✅ 既存機能の保持と動作確認

## 検証方法

### 修正前の状態確認
```bash
# 現在のエラー数を記録
pnpm --filter @hierarchidb/plugin-loader-spreadsheet-plugin typecheck 2>&1 | grep "error" | wc -l
pnpm --filter @hierarchidb/plugin-loader-basemap-plugin typecheck 2>&1 | grep "error" | wc -l  
pnpm --filter @hierarchidb/plugin-loader-styler-plugin typecheck 2>&1 | grep "error" | wc -l
```

### 修正後の改善確認
```bash  
# 同じコマンドでエラー数の劇的減少を確認
# 期待値: 80-90% のエラー減少
```

## お詫びと学んだ教訓

1. **表面的分析の危険性**: 型エラーの量に惑わされ、実装内容を十分調査しなかった
2. **前提の確認不足**: 「完成したプラグイン」という前提を無視した  
3. **過剰な解決策**: 簡単な修正で済む問題に複雑な解決策を提案した

**正しいアプローチ**: まず既存実装を理解し、最小限の変更で移行を完了する

この修正された指示書により、各プラグインの既存機能を保持しながら、数時間で型エラーを解決できます。