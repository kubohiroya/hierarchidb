# Copy/Paste機能 - TDD Red Phase

## 概要

TreeViewControllerにCopy/Paste機能を追加するためのTDD Red Phaseテストコード設計書。

## テストコード設計

### 1. テストケース一覧

#### Copy操作
- ✅ copyメソッドの存在確認
- ✅ 選択ノードのクリップボードへのコピー
- ✅ 複数ノードの同時コピー
- ✅ コピー成功時のクリップボード状態更新

#### Cut操作
- ✅ cutメソッドの存在確認  
- ✅ カットノードの視覚的マーキング
- ✅ カット状態の管理

#### Paste操作
- ✅ pasteメソッドの存在確認
- ✅ クリップボードからのペースト実行
- ✅ ペースト可能性の事前チェック
- ✅ ターゲット互換性の検証

#### クリップボード管理
- ✅ カット&ペースト後の自動クリア
- ✅ 複数コピー操作での上書き処理
- ✅ 操作タイプ（copy/cut）の区別

#### 異なるノードタイプ
- ✅ 複数タイプのノード混在処理
- ✅ ペースト先との互換性検証

### 2. 信頼性レベル

- 🟢 **青信号（10テスト）**: 標準的なCopy/Paste仕様に基づく
- 🟡 **黄信号（3テスト）**: 一般的なUIパターンからの推測
- 🔴 **赤信号（2テスト）**: ビジネスルール依存の推測

### 3. 期待される失敗メッセージ

```javascript
// copyNodesメソッドが未定義
AssertionError: expected undefined not to be undefined

// copyNodes関数が存在しない
TypeError: result.current.copyNodes is not a function

// クリップボードデータが未定義
AssertionError: expected undefined to be defined

// canPasteプロパティが未定義
AssertionError: expected undefined to be false
```

### 4. 実装インターフェース要件

```typescript
interface CopyPasteOperations {
  // 基本操作
  copyNodes: (nodeIds: NodeId[]) => Promise<CopyResult>;
  cutNodes: (nodeIds: NodeId[]) => Promise<CutResult>;
  pasteNodes: (targetId: NodeId) => Promise<PasteResult>;
  
  // 状態管理
  clipboardData: ClipboardData | null;
  cutNodeIds: NodeId[];
  canPaste: boolean;
  
  // 補助メソッド
  canPasteToTarget: (targetId: NodeId) => boolean;
  clearClipboard: () => void;
}

interface ClipboardData {
  operation: 'copy' | 'cut';
  nodes: NodeId[];
  timestamp: number;
}

interface CopyResult {
  success: boolean;
  copiedNodes: NodeId[];
  clipboard?: ClipboardData;
}

interface CutResult {
  success: boolean;
  cutNodes: NodeId[];
  clipboard?: ClipboardData;
}

interface PasteResult {
  success: boolean;
  pastedNodes: TreeNode[];
}
```

## テスト実行コマンド

```bash
# 単体テスト実行
pnpm test:run -- useTreeViewController.test.tsx

# Copy/Paste機能のみテスト
pnpm test:run -- useTreeViewController.test.tsx -t "Copy/Paste"

# Watch モードでテスト
pnpm test -- useTreeViewController.test.tsx
```

## 日本語コメントの意図

各テストには以下の日本語コメントを配置：

1. **テスト目的**: なぜこのテストが必要か
2. **テスト内容**: 何を検証するか
3. **期待される動作**: 正常時の挙動
4. **信頼性レベル**: 実装の確実性評価
5. **確認内容**: 各アサーションの意味

これによりテストの意図が明確になり、実装者が要件を正確に理解できる。

## 品質判定

### ✅ 高品質達成項目

- テスト実行: 失敗することを確認済み
- 期待値: 明確で具体的
- アサーション: 適切な検証項目
- 実装方針: 明確なインターフェース定義
- 日本語コメント: 完備

### 次のステップ

**次のお勧めステップ: `/tdd-green` でGreenフェーズ（最小実装）を開始します。**

最小実装では、以下を実装予定：
1. インターフェース定義の追加
2. プレースホルダーメソッドの実装
3. StateManagerとの連携
4. 基本的なクリップボード管理ロジック