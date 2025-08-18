# TreeConsole移植計画（簡潔版）

## 目的
既存TreeConsoleコンポーネントを `references/eria-cartograph/app0` から `packages/ui-treeconsole` へ移植し、新しいAPIに対応させる

## 移植方針

### 1. 基本方針
- 既存UIコンポーネントをそのまま移植
- 新規設計は最小限に留める
- APIアダプター層で新旧の差異を吸収

### 2. APIアダプター実装

#### 必要なアダプター

```typescript
// adapters/WorkerAPIAdapter.ts
import { WorkerAPI } from '@hierarchidb/api';
import type { TreeViewController } from '../types';

export class WorkerAPIAdapter {
  constructor(private api: WorkerAPI) {}

  // 古いsubscribeSubTree → 新しいobserveSubtree
  async subscribeToNode(nodeId: string, callback: (changes) => void) {
    const observable = await this.api.observeSubtree({
      commandId: generateId(),
      groupId: generateGroupId(), 
      kind: 'observeSubtree',
      payload: { rootNodeId: nodeId },
      issuedAt: Date.now()
    });
    
    // Observableをコールバックパターンに変換
    return observable.subscribe(callback);
  }

  // 古いmoveNodes呼び出し → CommandEnvelope形式
  async moveNodes(nodeIds: string[], targetId: string) {
    return this.api.moveNodes({
      commandId: generateId(),
      groupId: generateGroupId(),
      kind: 'moveNodes',
      payload: { nodeIds, toParentId: targetId },
      issuedAt: Date.now()
    });
  }
}
```

### 3. ui-client統合

```typescript
// hooks/useTreeViewController.ts
import { useWorkerClient } from '@hierarchidb/ui-client';
import { WorkerAPIAdapter } from '../adapters/WorkerAPIAdapter';

export function useTreeViewController(options) {
  const { api } = useWorkerClient();
  const adapter = useMemo(() => new WorkerAPIAdapter(api), [api]);
  
  // 既存のロジックをそのまま使用
  // ただしAPIコールはadapter経由
}
```

## 移植手順

### Phase 1: コンポーネント移植（2日）
1. TreeConsole関連コンポーネントをコピー
2. import pathの修正
3. 型定義の調整

### Phase 2: APIアダプター実装（2日）
1. WorkerAPIAdapterクラス作成
2. pub-sub変換ロジック実装
3. CommandEnvelope生成ヘルパー作成

### Phase 3: 統合テスト（1日）
1. 動作確認
2. エラーハンドリング調整

## ファイル構成

```
packages/ui-treeconsole/
├── src/
│   ├── components/        # 既存UIをそのまま移植
│   │   ├── TreeConsole.tsx
│   │   ├── TreeTableConsolePanel.tsx
│   │   ├── TreeConsoleHeader.tsx
│   │   ├── TreeConsoleToolbar.tsx
│   │   └── ...
│   ├── hooks/            # 既存hooksを移植＋アダプター対応
│   │   └── useTreeViewController.tsx
│   ├── adapters/         # 新旧API変換層（新規）
│   │   └── WorkerAPIAdapter.ts
│   └── index.ts
└── package.json
```

## 注意点

1. **Dexie.jsには触らない** - すべてWorkerAPI経由
2. **既存UIロジックは保持** - 見た目と動作を変えない
3. **最小限のアダプター** - 必要な変換のみ実装

## 成果物

- 既存と同じ見た目・操作感のTreeConsole
- 新しいWorkerAPIに対応
- @hierarchidb/ui-clientと統合