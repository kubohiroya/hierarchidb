# 重複ファイル統合計画

## 発見された重複

### 1. CommandEnvelope
**現状**: 
- core版とworker版で構造が異なる
- core: `kind`フィールド、worker: `type`フィールド

**統合方針**:
- coreの定義を正とする
- workerは型エイリアスで対応

### 2. EntityHandler
**現状**:
- 3箇所に同じインターフェース定義
- core、worker/handlers、worker/registry/types

**統合方針**:
- coreの定義を正とする
- 他は削除してcoreから import

### 3. HierarchicalPluginRouter
**現状**:
- 4つのファイルが存在
- コンポーネントとロジックが分離

**統合方針**:
- `.tsx`と`.ts`を統合
- red-phase.test.tsxは削除（古いTDDファイル）

## 実装計画

### Step 1: EntityHandler統合
```typescript
// packages/worker/src/handlers/types.ts
export type { EntityHandler } from '@hierarchidb/core/types';

// packages/worker/src/registry/types/unified-plugin.ts
export type { EntityHandler } from '@hierarchidb/core/types';
```

### Step 2: CommandEnvelope統合
```typescript
// packages/worker/src/command/types.ts
import type { CommandEnvelope as CoreCommandEnvelope } from '@hierarchidb/core/types';

// Worker固有の拡張が必要な場合
export interface WorkerCommandEnvelope<T, P> extends CoreCommandEnvelope<T, P> {
  // worker固有フィールド
}

// または型エイリアス
export type CommandEnvelope<T extends string, P> = CoreCommandEnvelope<T, P>;
```

### Step 3: HierarchicalPluginRouter統合
- `.ts`の内容を`.tsx`に統合
- `.ts`ファイルを削除
- red-phase.test.tsxを削除