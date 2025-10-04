# Worker初期化サービス統合ガイド

## 概要

Phase 4で実装された`workerClient.ts`サービスは、TanStack Routerの`beforeLoad`フックで
Worker初期化を確実に行うための統一的なインターフェースを提供します。

## 基本的な使い方

### 1. シンプルな統合

最もシンプルな使い方は、`beforeLoad`フックで`ensureWorkerStarted()`を呼び出すことです:

```typescript
import { createRoute } from '@tanstack/react-router';
import { ensureWorkerStarted } from '../loaders/workerClient.js';
import { rootRoute } from './rootRoute.js';

export const myRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'my-path',
  beforeLoad: async () => {
    // Worker初期化を確実に待機
    const client = await ensureWorkerStarted();
    return { client };
  },
  component: MyComponent,
});
```

### 2. AbortSignalとの統合

TanStack Routerは自動的に`AbortSignal`を提供します。これを使うことで、
ナビゲーションがキャンセルされた場合にWorker初期化もキャンセルできます:

```typescript
export const myRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'my-path',
  beforeLoad: async ({ abortController }) => {
    const client = await ensureWorkerStarted({
      signal: abortController.signal,
    });
    return { client };
  },
});
```

### 3. カスタムタイムアウト/リトライ設定

特定のルートで異なる設定を使いたい場合:

```typescript
export const heavyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'heavy-operation',
  beforeLoad: async ({ abortController }) => {
    const client = await ensureWorkerStarted({
      timeoutMs: 30000, // 30秒のタイムアウト
      retryDelays: [2000, 4000, 8000], // より長いリトライ間隔
      signal: abortController.signal,
      debug: import.meta.env.DEV, // 開発環境でデバッグログを有効化
    });
    return { client };
  },
});
```

## ツリールートとの統合例

### baseRoute の更新（推奨）

既存の`baseRoute.tsx`を更新して、新しい`workerClient`サービスを使用:

```typescript
// app/src/router/routes/tree/baseRoute.tsx
import { createRoute, Outlet } from '@tanstack/react-router';
import { ensureWorkerStarted } from '../../loaders/workerClient.js';
import { rootRoute } from '../rootRoute.js';

export const treeBaseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 't',
  beforeLoad: async ({ abortController }) => {
    // 新しいworkerClientサービスを使用
    const client = await ensureWorkerStarted({
      signal: abortController.signal,
      timeoutMs: 20000,
      debug: import.meta.env.DEV,
    });
    return { client };
  },
  component: TreeBaseLayout,
});

function TreeBaseLayout() {
  return <Outlet />;
}
```

### layoutRoute での使用

子ルートでは、親から提供された`client`を使用するか、独自に初期化できます:

```typescript
// app/src/router/routes/tree/layoutRoute.tsx
import { createRoute } from '@tanstack/react-router';
import { treeBaseRoute } from './baseRoute.js';
import { loadTree } from '../../loaders/treeLoaders.js';

export const treeLayoutRoute = createRoute({
  getParentRoute: () => treeBaseRoute,
  path: '$treeId',
  loader: async ({ params, context }) => {
    // 親ルートから提供されたclientを使用
    const { client } = context;
    
    // ツリーデータをロード
    const tree = await loadTree({ 
      treeId: params.treeId,
      client 
    });
    
    return { tree };
  },
});
```

## APIリファレンス

### `ensureWorkerStarted(options?)`

Worker初期化を確実に行う主要な関数。

#### パラメータ

```typescript
interface WorkerStartOptions {
  timeoutMs?: number;     // デフォルト: 20000 (20秒)
  retryDelays?: number[]; // デフォルト: [1000, 2000, 5000]
  signal?: AbortSignal;   // キャンセルシグナル
  debug?: boolean;        // デフォルト: false
}
```

#### 戻り値

```typescript
Promise<Remote<WorkerAPI>>
```

Worker APIクライアントを返すPromise。

#### エラー

- `DOMException('AbortError')` - シグナルがabortされた場合
- `Error('Worker initialization timeout')` - タイムアウトした場合
- `Error('Worker initialization failed after N attempts')` - すべてのリトライが失敗した場合

### `getWorkerClient()`

キャッシュされたWorkerクライアントを同期的に取得。

```typescript
function getWorkerClient(): Remote<WorkerAPI> | null
```

- Workerが初期化済みの場合: クライアントを返す
- 未初期化の場合: `null`を返す
- 初期化をトリガーしない

#### 使用例

```typescript
const client = getWorkerClient();
if (client) {
  // Worker準備完了
  const trees = await client.getQueryAPI().getAllTrees();
} else {
  // ensureWorkerStarted()の呼び出しが必要
  await ensureWorkerStarted();
}
```

### `isWorkerReady()`

Workerの準備状態を確認。

```typescript
function isWorkerReady(): boolean
```

#### 使用例

```typescript
if (isWorkerReady()) {
  console.log('Worker is ready');
} else {
  console.log('Worker needs initialization');
}
```

## ベストプラクティス

### 1. 親ルートで初期化

アプリケーションの早い段階（例: `/t`ルート）でWorker初期化を行い、
子ルートでは親から提供されたクライアントを使用します。

```typescript
// 親ルート (baseRoute)
beforeLoad: async () => {
  const client = await ensureWorkerStarted();
  return { client };
}

// 子ルート (layoutRoute)
loader: async ({ context }) => {
  const { client } = context; // 親から取得
  // clientを使用してデータロード
}
```

### 2. AbortSignalの活用

常に`abortController.signal`を渡して、ナビゲーションキャンセル時に
適切にクリーンアップされるようにします。

```typescript
beforeLoad: async ({ abortController }) => {
  const client = await ensureWorkerStarted({
    signal: abortController.signal,
  });
  return { client };
}
```

### 3. デバッグログの使用

開発環境でのみデバッグログを有効化:

```typescript
const client = await ensureWorkerStarted({
  debug: import.meta.env.DEV,
});
```

### 4. エラーハンドリング

```typescript
beforeLoad: async ({ abortController }) => {
  try {
    const client = await ensureWorkerStarted({
      signal: abortController.signal,
    });
    return { client };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      // ナビゲーションキャンセル - 無視してOK
      throw error;
    }
    // その他のエラーは適切にハンドリング
    console.error('Worker initialization failed:', error);
    throw error;
  }
}
```

## 移行パス

### 段階的な移行

1. **Phase 4（現在）**: 新しいTanStack Routerルートで`workerClient`を使用
2. **Phase 5（次）**: すべてのルートで`workerClient`を使用し、React Routerを削除

### 既存コードとの互換性

`workerClient`は既存の`WorkerProvider`と完全に互換性があります:

- `WorkerProvider`は引き続き動作
- `workerClient`は同じ`WorkerStateStore`を使用
- イベント(`hierarchidb-worker-init-complete`)は両方で発火

### React Routerからの移行

React Routerの`clientLoader`を使用している場合:

```typescript
// React Router (旧)
export const clientLoader = async () => {
  const result = await loadWorkerAPIClient();
  return result;
};

// TanStack Router (新)
export const myRoute = createRoute({
  beforeLoad: async () => {
    const client = await ensureWorkerStarted();
    return { client };
  },
});
```

## トラブルシューティング

### タイムアウトエラー

```
Error: Worker initialization timeout after 20000ms
```

**解決策**:
- `timeoutMs`を増やす
- ネットワーク接続を確認
- Worker スクリプトのロードを確認

### リトライ失敗

```
Error: Worker initialization failed after 3 attempts
```

**解決策**:
- ブラウザコンソールでエラー詳細を確認
- `debug: true`を有効化してログを確認
- Worker スクリプトの構文エラーをチェック

### AbortError

```
DOMException: The operation was aborted
```

**説明**: これは正常な動作です。ユーザーがナビゲーションをキャンセルした場合に発生します。

## まとめ

`workerClient`サービスは:

✅ TanStack Routerとシームレスに統合
✅ 自動リトライとタイムアウト
✅ AbortSignalサポート
✅ 既存コードと完全互換
✅ 型安全なAPI

これにより、Worker初期化の信頼性が向上し、より堅牢なアプリケーションを構築できます。
