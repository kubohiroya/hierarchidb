# HierarchiDB テスト戦略

## はじめに

このテスト戦略ドキュメントでは、HierarchiDBプロジェクトにおける包括的なテスト方針と実装ガイドラインについて説明します。本ドキュメントは以下のような方を対象としています：

**読むべき人**: QA担当者、テストエンジニア、開発者、テクニカルリーダー、品質保証責任者、BaseMap・StyleMap・Shape・Spreadsheet・Projectプラグインのテスト実装を担当する開発者

**前提知識**: Vitest、Playwright、React Testing Library、モッキング戦略、テストピラミッド、CI/CD、Web Worker テスト、IndexedDB テスト

**読むタイミング**: テスト実装を開始する前、テストスイートの設計時、品質基準の策定時、CI/CD パイプライン構築時に参照してください。特にSpreadsheetプラグインのような新機能開発時は、本戦略に従ってテストを設計することで、効率的で保守性の高いテストスイートを構築できます。

本戦略は、テストピラミッドの原則に基づき、効率的で信頼性の高いテストエコシステムの構築を目指しています。

## 概要

本ドキュメントは、HierarchiDBプロジェクトのテスト戦略を定義します。
効率的で保守性の高いテストを実現するため、テストピラミッドの原則に従い、
E2Eテストを最小限にし、統合テストと単体テストを重視します。

## テストピラミッド構成

```
        /\        E2Eテスト（10%）
       /  \       - 重要なユーザーフロー
      /    \      - クリティカルパスのみ
     /------\     
    /        \    統合テスト（30%）
   /          \   - Worker API層のテスト
  /            \  - IndexedDB操作のテスト
 /--------------\ 
/                \ 単体テスト（60%）
/________________\ - 個別関数/クラスのテスト
```

## 1. 単体テスト（Unit Tests）

### 対象
- 純粋関数
- ユーティリティ関数
- 個別のクラスメソッド
- ビジネスロジック

### 実行環境
- Node.js環境
- Vitest
- 高速実行（ミリ秒単位）

### 例
```typescript
// packages/core/src/utils/__tests__/tree.test.ts
describe('TreeNodeUtils', () => {
  it('should calculate node depth correctly', () => {
    const node = { path: '/root/parent/child' };
    expect(getNodeDepth(node)).toBe(3);
  });
});
```

## 2. 統合テスト（Integration Tests）

### 対象
- Worker API全体の動作
- データベース操作
- コマンドパターンの実行
- 複数コンポーネントの連携

### 実行環境
- Node.js環境
- fake-indexeddb（IndexedDBのエミュレーション）
- Comlinkのモック
- UIなし

### 特徴
- **E2Eテストの10倍以上高速**
- **安定性が高い**（ブラウザの不安定要素がない）
- **デバッグが容易**
- **並列実行可能**

### 実装例
```typescript
// packages/worker/src/__tests__/integration/folder-operations.test.ts
describe('フォルダ操作の統合テスト', () => {
  let api: WorkerAPIImpl;
  
  beforeEach(async () => {
    // Worker APIを直接インスタンス化（UIなし）
    api = new WorkerAPIImpl('test-db');
    await api.initialize();
  });
  
  it('フォルダを作成できる', async () => {
    const result = await api.createWorkingCopyForCreate({
      parentNodeId: 'root',
      nodeType: 'folder',
      initialData: { name: 'Test Folder' }
    });
    
    expect(result.success).toBe(true);
  });
});
```

## 3. E2Eテスト（End-to-End Tests）

### 対象（最小限に限定）
- **クリティカルなユーザーフロー**
  - 初回起動とセットアップ
  - ファイル/フォルダの基本CRUD操作
  - ドラッグ&ドロップによる移動
  
### 対象外（統合テストで代替）
- 詳細なバリデーション
- エラーハンドリングの詳細
- パフォーマンステスト
- 複雑な条件分岐

### 実行環境
- Playwright
- 実際のブラウザ環境
- 実行時間: 数秒〜数十秒/テスト

### 実装方針
```typescript
// e2e/critical-path.spec.ts
test('ユーザーがフォルダを作成して削除できる', async ({ page }) => {
  // 最小限の操作のみ
  await page.goto('/');
  await createFolder(page, 'Test');
  await deleteFolder(page, 'Test');
  // 詳細な検証は統合テストで実施
});
```

## 4. テスト環境のセットアップ

### Node環境でのWeb API エミュレーション

```typescript
// packages/worker/vitest.setup.ts

// IndexedDB API
import 'fake-indexeddb/auto';

// Web Worker API のモック
class WorkerMock {
  postMessage(message: any): void {
    // 直接実行
  }
}

// Comlink のモック（Workerを介さず直接実行）
const comlinkMock = {
  wrap: <T>(target: any): T => target,
  expose: (api: any) => api,
};
```

## 5. テスト実行戦略

### 開発時
```bash
# 単体テスト（高速、常時実行）
pnpm test:unit --watch

# 統合テスト（変更時に実行）
pnpm test:integration
```

### CI/CD
```bash
# 全テスト実行（並列）
pnpm test:unit      # 〜10秒
pnpm test:integration # 〜30秒
pnpm test:e2e       # 〜2分（最小限）
```

## 6. カバレッジ目標

| テストタイプ | カバレッジ目標 | 優先度 |
|------------|--------------|--------|
| 単体テスト | 80%以上 | 高 |
| 統合テスト | 70%以上 | 高 |
| E2Eテスト | クリティカルパスのみ | 中 |

## 7. 移行計画

### Phase 1: 統合テスト環境の構築（完了）
- ✅ fake-indexeddbの導入
- ✅ Worker/Comlinkのモック
- ✅ サンプル統合テストの作成

### Phase 2: 既存E2Eテストの移行
- [ ] E2Eテストの分析と分類
- [ ] 統合テストへの移行候補の特定
- [ ] 段階的な移行実施

### Phase 3: 新規テストの作成
- [ ] 未カバー機能の統合テスト作成
- [ ] パフォーマンステストの追加
- [ ] エラーケースの網羅

## 8. ベストプラクティス

### DO ✅
- 統合テストを優先する
- テストをシンプルに保つ
- データの独立性を保証する
- 並列実行を前提に設計する

### DON'T ❌
- E2Eテストで詳細な検証をしない
- UIの見た目をE2Eでテストしない
- 不安定なセレクタに依存しない
- テスト間で状態を共有しない

## 9. テストコマンド

```json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest --run --testPathPattern=\\.test\\.ts$",
    "test:integration": "vitest --run --testPathPattern=integration",
    "test:e2e": "playwright test",
    "test:all": "pnpm test:unit && pnpm test:integration && pnpm test:e2e",
    "test:coverage": "vitest --coverage"
  }
}
```

## 10. 効果測定

### Before（E2E中心）
- テスト実行時間: 10分以上
- 不安定なテスト: 20%
- メンテナンスコスト: 高

### After（統合テスト中心）
- テスト実行時間: 2分以内
- 不安定なテスト: 5%以下
- メンテナンスコスト: 低

## まとめ

本テスト戦略により、以下を実現します：

1. **テスト実行時間の大幅短縮**（10分→2分）
2. **テストの安定性向上**（失敗率20%→5%）
3. **開発体験の向上**（高速フィードバック）
4. **保守コストの削減**（シンプルなテスト構造）

統合テストを中心とした戦略により、品質を維持しながら開発効率を大幅に向上させます。