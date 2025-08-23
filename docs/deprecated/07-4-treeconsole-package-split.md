# 7.4 TreeConsoleパッケージ分割設計書

## 概要

現在の`@hierarchidb/ui-treeconsole`パッケージが肥大化しているため、責務ごとに複数のパッケージに分割し、保守性と再利用性を向上させます。

## 設計原則

### 1. 単一責任の原則
各パッケージは明確に定義された単一の責務を持つ

### 2. 依存関係の明確化
- 循環依存を避ける
- 共通型は`@hierarchidb/core`に集約
- プレゼンテーション層 → オーケストレーション層の単方向依存

### 3. 段階的移行
既存機能を壊さず、段階的にパッケージを分割

## パッケージ構成

### 1. プレゼンテーション層パッケージ

#### @hierarchidb/ui-treeconsole-breadcrumb
**責務**: パンくずリストUIの提供
```typescript
// 主要エクスポート
export { TreeConsoleBreadcrumb } from './TreeConsoleBreadcrumb';
export type { TreeConsoleBreadcrumbProps } from './types';
```

**依存関係**:
- `@hierarchidb/core` - TreeNode型定義
- `@mui/material` - UIコンポーネント

#### @hierarchidb/ui-treeconsole-toolbar
**責務**: ツールバーとアクションボタンUIの提供
```typescript
// 主要エクスポート
export { TreeConsoleToolbar } from './TreeConsoleToolbar';
export { TreeConsoleActions } from './TreeConsoleActions';
export type { TreeConsoleToolbarProps, TreeConsoleActionsProps } from './types';
```

**依存関係**:
- `@hierarchidb/core` - TreeNode型定義
- `@mui/material` - UIコンポーネント
- `@mui/icons-material` - アイコン

#### @hierarchidb/ui-treeconsole-footer
**責務**: フッター情報UIの提供
```typescript
// 主要エクスポート
export { TreeConsoleFooter } from './TreeConsoleFooter';
export type { TreeConsoleFooterProps } from './types';
```

**依存関係**:
- `@mui/material` - UIコンポーネント

#### @hierarchidb/ui-treeconsole-treetable
**責務**: メインテーブルUIの提供
```typescript
// 主要エクスポート
export { TreeTableView } from './presentation/TreeTableView';
export { TreeTableCore } from './TreeTableCore';
export type { TreeTableViewProps } from './types';
```

**依存関係**:
- `@hierarchidb/core` - TreeNode型定義
- `@tanstack/react-table` - テーブル機能
- `@mui/material` - UIコンポーネント

#### @hierarchidb/ui-treeconsole-trashbin
**責務**: ゴミ箱専用UIの提供
```typescript
// 主要エクスポート
export { TrashBinColumns } from './TrashBinColumns';
export { TrashBinActions } from './TrashBinActions';
export type { TrashBinColumnsProps } from './types';
```

**依存関係**:
- `@hierarchidb/core` - TreeNode型定義
- `@hierarchidb/ui-treeconsole-treetable` - 基本テーブル機能

#### @hierarchidb/ui-treeconsole-speeddial
**責務**: スピードダイアルUIの提供
```typescript
// 主要エクスポート
export { TreeConsoleSpeedDialDeprecated } from './TreeConsoleSpeedDialDeprecated';
export type { TreeConsoleSpeedDialProps } from './types';
```

**依存関係**:
- `@mui/material` - SpeedDial コンポーネント
- `@mui/icons-material` - アイコン

### 2. オーケストレーション層パッケージ

#### @hierarchidb/ui-treeconsole（名前変更後）
**責務**: 全体の統合とオーケストレーション
```typescript
// 主要エクスポート
export { TreeTableConsolePanel } from './TreeTableConsolePanel';
export { useTreeTableOrchestrator } from './orchestrator';
export { WorkerAPIAdapter } from './adapters';
export * from './state'; // Jotai atoms
```

**依存関係**:
- すべてのプレゼンテーション層パッケージ
- `@hierarchidb/api` - WorkerAPI
- `@hierarchidb/ui-client` - Worker接続
- `jotai` - 状態管理

## ディレクトリ構造

```
packages/
├── ui-treeconsole-breadcrumb/
│   ├── src/
│   │   ├── TreeConsoleBreadcrumb.tsx
│   │   ├── types.ts
│   │   └── openstreetmap-type.ts
│   ├── package.json
│   └── tsconfig.json
│
├── ui-treeconsole-toolbar/
│   ├── src/
│   │   ├── TreeConsoleToolbar.tsx
│   │   ├── TreeConsoleActions.tsx
│   │   ├── types.ts
│   │   └── openstreetmap-type.ts
│   ├── package.json
│   └── tsconfig.json
│
├── ui-treeconsole-footer/
│   ├── src/
│   │   ├── TreeConsoleFooter.tsx
│   │   ├── types.ts
│   │   └── openstreetmap-type.ts
│   ├── package.json
│   └── tsconfig.json
│
├── ui-treeconsole-treetable/
│   ├── src/
│   │   ├── presentation/
│   │   │   ├── TreeTableView.tsx
│   │   │   ├── TreeTableHeader.tsx
│   │   │   └── TreeTableBody.tsx
│   │   ├── TreeTableCore.tsx
│   │   ├── columns/
│   │   ├── types.ts
│   │   └── openstreetmap-type.ts
│   ├── package.json
│   └── tsconfig.json
│
├── ui-treeconsole-trashbin/
│   ├── src/
│   │   ├── TrashBinColumns.tsx
│   │   ├── TrashBinActions.tsx
│   │   ├── types.ts
│   │   └── openstreetmap-type.ts
│   ├── package.json
│   └── tsconfig.json
│
├── ui-treeconsole-speeddial/
│   ├── src/
│   │   ├── TreeConsoleSpeedDialDeprecated.tsx
│   │   ├── types.ts
│   │   └── openstreetmap-type.ts
│   ├── package.json
│   └── tsconfig.json
│
└── ui-treeconsole/
    ├── src/
    │   ├── TreeTableConsolePanel.tsx
    │   ├── orchestrator/
    │   │   ├── openstreetmap-type.ts
    │   │   ├── SelectionOrchestrator.ts
    │   │   ├── ExpansionOrchestrator.ts
    │   │   ├── EditingOrchestrator.ts
    │   │   ├── DragDropOrchestrator.ts
    │   │   ├── SearchOrchestrator.ts
    │   │   └── SubscriptionOrchestrator.ts
    │   ├── state/
    │   │   ├── openstreetmap-type.ts
    │   │   ├── core/
    │   │   ├── features/
    │   │   └── config/
    │   ├── adapters/
    │   │   ├── WorkerAPIAdapter.ts
    │   │   ├── commands/
    │   │   └── subscriptions/
    │   └── openstreetmap-type.ts
    ├── package.json
    └── tsconfig.json
```

## 移行計画

### Phase 1: 独立性の高いUIコンポーネント（Week 1）
1. `ui-treeconsole-breadcrumb`パッケージ作成
2. `ui-treeconsole-toolbar`パッケージ作成  
3. `ui-treeconsole-footer`パッケージ作成
4. 各パッケージのStorybook作成

### Phase 2: TreeTable関連（Week 2）
1. `ui-treeconsole-treetable`パッケージ作成
2. `ui-treeconsole-trashbin`パッケージ作成
3. テーブル機能の統合テスト

### Phase 3: 特殊UI（Week 3）
1. `ui-treeconsole-speeddial`パッケージ作成
2. アニメーションとインタラクションの確認

### Phase 4: オーケストレーター層の整理（Week 4）
1. `ui-treeconsole`を統合層として再構成
2. 全体統合テスト
3. パフォーマンス測定

## パッケージ間の通信

### Props Interface
各プレゼンテーション層パッケージは、propsを通じてのみ外部と通信：

```typescript
// ui-treeconsole-toolbar/types.ts
export interface TreeConsoleToolbarProps {
  selectedCount: number;
  totalCount: number;
  onRefresh: () => void;
  onDelete: () => void;
  onAdd: () => void;
  // ...
}
```

### Event Callback Pattern
UIイベントはコールバック関数として親コンポーネントに通知：

```typescript
// ui-treeconsole-treetable/types.ts
export interface TreeTableViewProps {
  onRowClick?: (nodeId: string) => void;
  onExpandedChange?: (nodeId: string) => void;
  onSelectionChange?: (nodeIds: string[]) => void;
  // ...
}
```

## ビルド設定

### 各パッケージのpackage.json例
```json
{
  "name": "@hierarchidb/ui-treeconsole-toolbar",
  "version": "0.1.0",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit",
    "storybook": "storybook dev -p 6007"
  },
  "dependencies": {
    "@hierarchidb/core": "workspace:*",
    "@mui/material": "^5.14.0",
    "@mui/icons-material": "^5.14.0"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "@storybook/react": "^7.0.0"
  }
}
```

### tsup設定
```typescript
// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/openstreetmap-type.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  external: ['react', 'react-dom', '@mui/material'],
});
```

## テスト戦略

### Unit Tests
各パッケージで独立したユニットテスト：
```bash
packages/ui-treeconsole-toolbar/
└── src/
    └── __tests__/
        ├── TreeConsoleToolbar.test.tsx
        └── TreeConsoleActions.test.tsx
```

### Integration Tests
`ui-treeconsole`パッケージで統合テスト：
```bash
packages/ui-treeconsole/
└── src/
    └── __tests__/
        └── integration/
            └── TreeTableConsolePanel.test.tsx
```

### Storybook
各パッケージで独立したStorybook：
- 視覚的回帰テスト
- コンポーネントカタログ
- インタラクションテスト

## パフォーマンス考慮事項

### Code Splitting
- 各パッケージは独立してバンドル可能
- 動的インポートで必要時のみロード

### Tree Shaking
- ES Modulesフォーマットで提供
- 未使用コードの自動削除

### Bundle Size監視
```json
{
  "size-limit": [
    {
      "path": "dist/index.js",
      "limit": "50 KB"
    }
  ]
}
```

## 利点

1. **保守性の向上**
   - 各パッケージが小さく理解しやすい
   - 責務が明確で変更の影響範囲が限定的

2. **再利用性**
   - 他のプロジェクトでも個別のUIコンポーネントを利用可能
   - NPMパッケージとして公開可能

3. **並行開発**
   - チームメンバーが独立して作業可能
   - マージコンフリクトの削減

4. **テストの簡素化**
   - 小さなパッケージは単体テストが書きやすい
   - モックの作成が容易

5. **パフォーマンス**
   - 必要なコンポーネントのみをインポート
   - バンドルサイズの最適化

## リスクと対策

### リスク1: パッケージ数の増加による複雑性
**対策**: 
- 明確な命名規則とドキュメント
- monorepoツール（Turborepo）の活用

### リスク2: 依存関係の管理
**対策**:
- pnpm workspaceで統一管理
- 依存関係の可視化ツール導入

### リスク3: ビルド時間の増加
**対策**:
- Turborepoのキャッシュ機能活用
- 並列ビルドの最適化

## まとめ

この分割により、TreeConsoleの各コンポーネントが独立性を保ちながら協調動作し、保守性と拡張性が大幅に向上します。段階的な移行により、既存機能への影響を最小限に抑えながら実装を進めることができます。