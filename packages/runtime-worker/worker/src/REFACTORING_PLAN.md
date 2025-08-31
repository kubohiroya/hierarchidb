# Worker Runtime リファクタリング実施計画

## 現状分析

### 既存の構造
```
src/
├── WorkerAPIImpl.ts (800行以上の巨大ファイル)
├── apis/ (個別API実装)
├── command/ (コマンド処理)
├── db/ (データベース)
├── lifecycle/ (ライフサイクル)
├── registry/ (レジストリ)
├── services/ (サービス層)
└── index.ts, worker.ts (エントリーポイント)
```

### 目標構造
```
src/
├── 1-bootstrap/
├── 2-plugin-system/
├── 3-database/
├── 4-api-implementation/
├── 5-operations/
└── worker.ts, index.ts
```

## 段階的リファクタリング計画

### Phase 1: 並行構造の構築（現在のコードを壊さない）

#### Step 1.1: 新構造にプロキシファイルを作成
```typescript
// 1-bootstrap/core-services/TreeService.ts
export { TreeQueryService as TreeService } from '../../services/TreeQueryService';

// 2-plugin-system/PluginSystemInitializer.ts
export { PluginRegistry } from '@hierarchidb/runtime-plugin-registry';

// 3-database/DatabaseInitializer.ts
export { CoreDB } from '../../db/CoreDB';
export { EphemeralDB } from '../../db/EphemeralDB';
```

#### Step 1.2: 新しいBootstrapperを既存のWorkerAPIImplを使って実装
```typescript
// 1-bootstrap/WorkerBootstrapper.ts
import { WorkerAPIImpl } from '../WorkerAPIImpl';

export class WorkerBootstrapper {
  async bootstrap() {
    // 既存のWorkerAPIImplを使用
    const api = new WorkerAPIImpl();
    await api.initialize();
    return api;
  }
}
```

### Phase 2: 段階的な移行

#### Step 2.1: WorkerAPIImplから初期化ロジックを抽出
- initialize()メソッドの内容を新しいBootstrapperに移動
- 依存関係の注入パターンに変更

#### Step 2.2: サービスを新構造に移動
- services/* → 1-bootstrap/core-services/
- db/* → 3-database/
- registry/* → 2-plugin-system/

#### Step 2.3: APIレイヤーの分離
- WorkerAPIImplをファサードとして純粋化
- 実装を4-api-implementation/に移動

### Phase 3: クリーンアップ

#### Step 3.1: 旧構造の削除
- 旧ディレクトリを削除
- importパスをすべて更新

#### Step 3.2: テストとビルド確認
- 型チェック: `pnpm typecheck`
- ビルド: `pnpm build`
- テスト: `pnpm test`

## 実装順序（ビルド可能な状態を維持）

### 1. プロキシレイヤーの作成（今すぐ実装可能）

```typescript
// 1-bootstrap/core-services/index.ts
export * from '../../services/TreeQueryService';
export * from '../../services/TreeMutationService';
export * from '../../services/NodeTypeService';
```

### 2. 新Bootstrapperの作成（既存コードをラップ）

```typescript
// 1-bootstrap/WorkerBootstrapper.ts
import { WorkerAPIImpl } from '../WorkerAPIImpl';
import * as Comlink from 'comlink';

export class WorkerBootstrapper {
  private apiImpl?: WorkerAPIImpl;
  
  async bootstrap(): Promise<BootstrapResult> {
    try {
      // 既存のAPIを使用
      this.apiImpl = new WorkerAPIImpl();
      await this.apiImpl.initialize();
      
      // Comlink公開
      Comlink.expose(this.apiImpl);
      
      return { success: true };
    } catch (error) {
      return { success: false, error };
    }
  }
}
```

### 3. worker.tsの更新（新旧両対応）

```typescript
// worker.ts
import { WorkerBootstrapper } from './1-bootstrap/WorkerBootstrapper';

// 新しいブートストラッパーを使用
const bootstrapper = new WorkerBootstrapper();
bootstrapper.bootstrap().then(result => {
  if (result.success) {
    console.log('Worker initialized with new bootstrapper');
  }
});
```

### 4. 段階的な内部移行

既存のコードを段階的に新構造に移行：

1. **データベース層** (db/* → 3-database/)
   - CoreDB, EphemeralDBを移動
   - 既存の場所にre-export

2. **プラグインシステム** (registry/* → 2-plugin-system/)
   - PluginRegistryを移動
   - 初期化ロジックを分離

3. **サービス層** (services/* → 1-bootstrap/core-services/)
   - 各サービスを移動
   - 依存性注入に変更

4. **API実装** (WorkerAPIImpl → 4-api-implementation/)
   - ファサードとして純粋化
   - 実装詳細を分離

## リスク管理

### ビルド維持戦略
- 各ステップでビルド可能な状態を維持
- CI/CDで自動チェック
- 段階的なPRでレビュー

### ロールバック計画
- 各フェーズでタグを作成
- 問題発生時は前のタグに戻す

### テスト戦略
- 既存のテストを維持
- 新構造用のテストを追加
- E2Eテストで動作確認

## タイムライン

- **Week 1**: Phase 1 (並行構造の構築)
- **Week 2**: Phase 2.1-2.2 (初期化ロジックとサービス移行)
- **Week 3**: Phase 2.3 (API層の分離)
- **Week 4**: Phase 3 (クリーンアップとテスト)

## 成功指標

1. ビルドが通る
2. 既存のテストがパスする
3. パフォーマンスの劣化がない
4. コードの可読性が向上
5. 初期化フローが明確になる