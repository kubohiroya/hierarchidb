# TreeConsole Migration アーキテクチャ設計

## 🟢 システム概要

TreeConsoleコンポーネントを `references/eria-cartograph/app0` から独立した再利用可能パッケージ `@hierarchidb/ui-treeconsole` に移植する。既存実装を最大限活用し、新しいWorkerAPI（`@hierarchidb/api`）への適合のみ実装する。

**信頼性レベル**: 🟢 青信号 - 要件定義書REQ-001, REQ-401に基づく

## 🟢 アーキテクチャパターン

### 選択パターン: レイヤードアーキテクチャ（HierarchiDB準拠）

```
┌─────────────────────────────────────────┐
│ UI Layer (@hierarchidb/ui-treeconsole)  │ ← 移植対象
├─────────────────────────────────────────┤
│ State Management Layer (ui-client)      │ ← 既存使用
├─────────────────────────────────────────┤
│ RPC Layer (Comlink + @hierarchidb/api)  │ ← 既存使用
├─────────────────────────────────────────┤
│ Worker Layer (@hierarchidb/worker)      │ ← 既存使用
├─────────────────────────────────────────┤
│ Database Layer (Dexie.js)               │ ← 既存使用
└─────────────────────────────────────────┘
```

**選択理由**: REQ-401により既存の4層アーキテクチャへの準拠が必須

## 🟢 移植戦略

### 1. コンポーネント移植アプローチ

```typescript
// 既存コンポーネントをほぼそのまま移植
references/eria-cartograph/app0/src/features/tree-console/
└── components/
    ├── TreeConsole.tsx                    → packages/ui-treeconsole/src/TreeConsole.tsx
    ├── TreeTableConsolePanel.tsx          → packages/ui-treeconsole/src/TreeTableConsolePanel.tsx  
    ├── TreeConsoleHeader.tsx              → packages/ui-treeconsole/src/components/TreeConsoleHeader.tsx
    └── ...
```

**信頼性レベル**: 🟢 青信号 - 既存実装の移植

### 2. API適合レイヤー

🟡 **黄信号**: 新旧API差異の解決のため妥当な推測

```typescript
// adapters/WorkerAPIAdapter.ts - 新旧APIの差異を吸収
export class WorkerAPIAdapter {
  constructor(private api: WorkerAPI) {}

  // 古い subscribeSubTree → 新しい observeSubtree
  async subscribeToSubtree(nodeId: string, callback: Function): Promise<() => void> {
    const observable = await this.api.observeSubtree({
      commandId: generateId(),
      groupId: generateGroupId(),
      kind: 'observeSubtree',
      payload: { rootNodeId: nodeId, includeInitialSnapshot: true },
      issuedAt: Date.now()
    });
    
    return observable.subscribe(callback);
  }

  // 古い moveNodes → 新しい CommandEnvelope形式
  async moveNodes(nodeIds: string[], targetId: string): Promise<CommandResult> {
    return this.api.moveNodes({
      commandId: generateId(),
      groupId: generateGroupId(),
      kind: 'moveNodes',
      payload: { nodeIds, toParentId: targetId, onNameConflict: 'auto-rename' },
      issuedAt: Date.now()
    });
  }
}
```

## 🟢 コンポーネント構成

### UI Layer Components (移植)

**信頼性レベル**: 🟢 青信号 - docs/07-2-ui-treeconsole.mdに基づく既存コンポーネント

- **TreeConsole.tsx** - メインコンテナコンポーネント
- **TreeTableConsolePanel.tsx** - テーブル表示とツールバー統合
- **TreeConsoleHeader.tsx** - ヘッダー（パンくず、タイトル）
- **TreeConsoleToolbar.tsx** - 操作ツールバー  
- **TreeConsoleContent.tsx** - 仮想化されたツリーテーブル本体
- **TreeConsoleFooter.tsx** - フッター（ガイドツアー等）
- **TreeConsoleActions.tsx** - FloatingActionButton群

### Hooks (移植＋適合)

```typescript
// hooks/useTreeViewController.tsx - メインロジック
export function useTreeViewController(options: UseTreeViewControllerOptions): TreeViewController {
  const { api } = useWorkerClient(); // 🟢 既存のui-client使用
  const adapter = useMemo(() => new WorkerAPIAdapter(api), [api]); // 🟡 適合レイヤー
  
  // 既存ロジックをそのまま維持、API呼び出しのみadapter経由に変更
}
```

## 🟢 依存関係管理

### 外部依存関係

**信頼性レベル**: 🟢 青信号 - REQ-405に基づく

```json
{
  "dependencies": {
    "@hierarchidb/core": "workspace:*",
    "@hierarchidb/api": "workspace:*", 
    "@hierarchidb/ui-client": "workspace:*",
    "react": "^18.0.0",
    "@mui/material": "^7.0.0",
    "@tanstack/react-table": "^8.0.0",
    "@tanstack/react-virtual": "^3.0.0",
    "@dnd-kit/core": "^6.0.0",
    "comlink": "^4.4.1"
  }
}
```

### 内部依存関係フロー

```
@hierarchidb/ui-treeconsole
├── @hierarchidb/ui-client (既存のWorker接続)
├── @hierarchidb/api (既存のWorkerAPI型定義)
└── @hierarchidb/core (既存の共通型定義)
```

## 🟡 パフォーマンス戦略

**信頼性レベル**: 🟡 黄信号 - NFR-001〜005から妥当な推測

### 仮想化

- **TanStack Virtual**: 10,000ノード対応（NFR-001）
- **Overscan設定**: 5-10行でスムーズスクロール（NFR-002）

### メモ化戦略

```typescript
// 重いレンダリング処理のメモ化
const MemoizedTreeRow = memo(TreeRow, (prev, next) => 
  prev.node.id === next.node.id && 
  prev.node.updatedAt === next.node.updatedAt
);
```

## 🟢 エラーハンドリング

**信頼性レベル**: 🟢 青信号 - REQ-104, EDGE-001〜004に基づく

### エラーバウンダリー

```typescript
// containers/TreeConsoleErrorBoundary.tsx
export class TreeConsoleErrorBoundary extends React.Component {
  // EDGE-003: Worker通信失敗時は読み取り専用モードにフォールバック
  // REQ-104: 適切なフォールバックUI表示
}
```

## 🟡 テスト戦略

**信頼性レベル**: 🟡 黄信号 - NFR-301から妥当な推測

### テスト構成

- **Unit Tests**: Jest + React Testing Library (90%カバレッジ目標)
- **Integration Tests**: WorkerAPIAdapter動作確認（集中テスト）
- **E2E Tests**: 実際のユーザーフローでの動作確認

## 📦 パッケージ構造（問題集約型）

```
packages/ui-treeconsole/
├── src/
│   ├── components/           # 移植されたUIコンポーネント
│   ├── hooks/               # 移植されたhooks
│   ├── adapters/            # 🟡 新旧API変換レイヤー（問題集約）
│   │   ├── WorkerAPIAdapter.ts        # メインアダプター
│   │   ├── commands/                  # コマンド変換
│   │   ├── subscriptions/             # サブスクリプション変換
│   │   ├── types.ts                  # アダプター専用型
│   │   └── utils.ts                  # ヘルパー関数
│   ├── types/               # 🟢 UI層特有の型定義のみ
│   └── openstreetmap-type.ts             # 公開API
├── tests/                   # テストファイル（アダプター集中テスト）
└── package.json
```

## 🟢 まとめ

この設計は既存TreeConsole実装の移植を主目的とし、新規設計要素を最小限（APIアダプターのみ）に抑制しています。HierarchiDBの既存アーキテクチャとWorkerAPIを最大限活用することで、信頼性が高く保守しやすいパッケージを実現します。