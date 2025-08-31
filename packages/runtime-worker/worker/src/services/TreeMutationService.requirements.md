# TreeMutationService 実装要件

## 概要
TreeMutationServiceは、ツリー構造の変更操作を管理するサービスです。Working Copy操作、ノードの物理的操作（移動、複製、削除など）、Undo/Redo機能を提供します。

## 機能要件

### 1. Working Copy操作

#### 1.1 createWorkingCopyForCreate
- 🟢 新規ノード作成用のDraft Working Copyを作成
- 🟢 EphemeralDBに保存
- 🟢 名前の一意性を保証（自動リネーム）
- 🟢 isDraft: trueを設定

#### 1.2 createWorkingCopy
- 🟢 既存ノード編集用のWorking Copyを作成
- 🟢 CoreDBから元ノードをコピー
- 🟢 EphemeralDBに保存
- 🟢 isDraft: falseを設定
- 🟢 元ノードのversionを記録（楽観的ロック用）

#### 1.3 discardWorkingCopyForCreate / discardWorkingCopy
- 🟢 Working CopyをEphemeralDBから削除
- 🟢 関連するエンティティも削除

#### 1.4 commitWorkingCopyForCreate
- 🟢 Draft Working CopyをCoreDBに新規ノードとして保存
- 🟢 CommandProcessorを通じてUndo/Redo対応
- 🟢 名前競合時の処理（error/auto-rename）

#### 1.5 commitWorkingCopy
- 🟢 既存ノードの更新をコミット
- 🟢 楽観的ロックチェック（expectedUpdatedAt）
- 🟢 CommandProcessorを通じてUndo/Redo対応

### 2. 物理的操作

#### 2.1 moveNodes
- 🟢 複数ノードを新しい親に移動
- 🟢 循環参照チェック
- 🟢 名前競合処理
- 🟢 descendantCount更新
- 🟢 Undo/Redo対応

#### 2.2 duplicateNodes
- 🟢 ノードとその子孫を複製
- 🟢 新しいIDを生成
- 🟡 IDマッピングの管理
- 🟢 名前に "(Copy)"を追加
- 🟢 Undo/Redo対応

#### 2.3 pasteNodes
- 🟢 ノードデータを指定の親にペースト
- 🟢 新しいIDで作成
- 🟢 名前競合処理
- 🟢 Undo/Redo対応

#### 2.4 moveToTrash
- 🟢 ノードをゴミ箱に移動
- 🟢 TrashItemPropertiesを設定
- 🟢 originalParentTreeNodeIdを記録
- 🟢 Undo/Redo対応

#### 2.5 permanentDelete
- 🟢 ノードを完全削除
- 🟢 子孫ノードも再帰的に削除
- 🟢 関連エンティティも削除
- 🟢 Undo/Redo対応（データのバックアップ）

#### 2.6 recoverFromTrash
- 🟢 ゴミ箱からノードを復元
- 🟢 元の親または指定の親に復元
- 🟢 名前競合処理
- 🟢 Undo/Redo対応

#### 2.7 importNodes
- 🟢 外部からノードデータをインポート
- 🟢 ID変換処理
- 🟢 名前競合処理
- 🟢 Undo/Redo対応

### 3. Undo/Redo

#### 3.1 undo
- 🟢 CommandProcessorのundoバッファから操作を取り消し
- 🟢 groupId単位で実行
- 🟢 逆操作の実行

#### 3.2 redo
- 🟢 CommandProcessorのredoバッファから操作を再実行
- 🟢 groupId単位で実行

## 非機能要件

### パフォーマンス
- 🟢 バッチ操作でのトランザクション最適化
- 🟢 大量ノード操作時のメモリ効率（100ノードずつバッチ処理）
- 🟢 応答時間200ms以内

### エラーハンドリング
- 🟢 各操作で適切なErrorCodeを返す
- 🟢 トランザクション失敗時のロールバック
- 🟢 部分的成功の防止（all-or-nothing）

### データ整合性
- 🟢 親子関係の整合性維持
- 🟢 循環参照の防止
- 🟢 descendantCount/hasChildrenの自動更新
- 🟢 楽観的ロックによる競合検出

## 依存関係
- CommandProcessor（Task 3）✅
- WorkingCopyOperations（Task 8）✅
- CoreDB/EphemeralDB（Task 1）✅
- NodeLifecycleManager（Task 7）✅

## テスト要件
1. 各操作の成功ケース
2. エラーケース（名前競合、循環参照、ノード不在）
3. Undo/Redo動作確認
4. トランザクション整合性
5. 大量データでのパフォーマンス
6. 並行操作時の動作

## 実装優先順位
1. Working Copy基本操作（create/discard/commit）
2. 基本的な物理操作（move/remove）
3. 高度な操作（duplicate/paste/import）
4. Undo/Redo統合
5. パフォーマンス最適化