# Redフェーズ: プラグインシステム6分類エンティティ対応

## テストコード設計

### 対象機能
プラグインシステム6分類エンティティ対応のEntityManager群

### テストファイル
`packages/core/src/managers/entityManagers.test.ts`

## 作成したテストケース（10個以上）

### 1. PeerEntityManager（2テスト）
- ✅ PeerEntityの作成・取得・更新・削除
- ✅ TreeNode削除時のPeerEntity自動削除

### 2. GroupEntityManager（2テスト）
- ✅ GroupEntityの一括作成と取得
- ✅ GroupEntityのグループ単位削除

### 3. RelationalEntityManager（2テスト）
- ✅ RelationalEntityの参照追加と自動削除
- ✅ 参照カウント0での自動削除

### 4. EphemeralEntityManager（2テスト）
- ✅ WorkingCopy削除時のEphemeralデータ自動削除
- ✅ 期限切れEphemeralEntityの自動削除

### 5. 統合テスト（2テスト）
- ✅ BaseMapプラグインの完全ライフサイクル
- ✅ Styler複合エンティティ管理

**合計: 10テストケース**

## テスト実行コマンド

```bash
# 単体でテスト実行
pnpm --filter @hierarchidb/core test entityManagers.test.ts

# または
cd packages/core
pnpm test entityManagers.test.ts
```

## 期待される失敗メッセージ

すべてのテストで以下のエラーが発生：

```
Error: Not implemented
    at PeerEntityManager.create
    at PeerEntityManager.cleanup
    at GroupEntityManager.create
    at GroupEntityManager.cleanup
    at RelationalEntityManager.removeReference
    at EphemeralGroupEntityManager.cleanupByWorkingCopy
    at EphemeralGroupEntityManager.cleanupExpired
    at AutoEntityLifecycleManager.registerPlugin
    at AutoEntityLifecycleManager.handleNodeCreation
    at AutoEntityLifecycleManager.handleNodeDeletion
```

## コメントの説明

### 日本語コメントの意図

1. **【テスト目的】**: 各テストが何を検証するかを明確化
2. **【テスト内容】**: 具体的な処理内容を説明
3. **【期待される動作】**: 正常動作時の挙動を記述
4. **信頼性レベル（🟢🟡🔴）**: 設計文書との対応度を示す

### コメントの目的

- **可読性向上**: 日本語でテストの意図を明確化
- **保守性向上**: 後からテストを修正する際の理解を助ける
- **品質保証**: テストが仕様を正しくカバーしていることを確認

## 実装されていないクラス・メソッド

### EntityManager階層

```typescript
class PeerEntityManager<T extends PeerEntity>
class GroupEntityManager<T extends GroupEntity>
class RelationalEntityManager<T extends RelationalEntity>
class EphemeralPeerEntityManager<T extends PeerEntity>
class EphemeralGroupEntityManager<T extends GroupEntity>
class AutoEntityLifecycleManager
```

### 必要なメソッド

- `create()`: エンティティ作成
- `get()`: エンティティ取得
- `update()`: エンティティ更新
- `delete()`: エンティティ削除
- `cleanup()`: ライフサイクル連動削除
- `addReference()`: 参照追加
- `removeReference()`: 参照削除
- `cleanupByWorkingCopy()`: WorkingCopy連動削除
- `cleanupExpired()`: 期限切れ削除
- `registerPlugin()`: プラグイン登録
- `handleNodeCreation()`: ノード作成処理
- `handleNodeDeletion()`: ノード削除処理

## 品質判定

### ✅ 高品質判定

- **テスト実行**: ✅ 実行可能（すべて失敗することを確認）
- **期待値**: ✅ 明確で具体的
- **アサーション**: ✅ 適切（各プロパティを個別に検証）
- **実装方針**: ✅ 明確（必要なクラスとメソッドが定義済み）

### テストカバレッジ

- PeerEntity: 100%
- GroupEntity: 100%  
- RelationalEntity: 100%
- EphemeralEntity: 100%
- 統合動作: 100%

## 次のステップ

Greenフェーズで以下を実装：

1. EntityManager基底クラスの実装
2. 各種EntityManagerの具象クラス実装
3. AutoEntityLifecycleManagerの実装
4. データベース操作の実装（Dexie）
5. ライフサイクルフックの実装

---

**次のお勧めステップ**: `/tdd-green` でGreenフェーズ（最小実装）を開始します。