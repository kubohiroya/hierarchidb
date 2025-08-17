## 6.3 Worker コマンドモデル

Undo/Redo を含むコマンドモデルと、更新・非更新コマンドの仕様を記述します。

### 6.3.1 コマンドの基本概念
- **コマンド**: Worker 内 DB への主として更新系の操作単位（Undo/Redo 対応）。
- **コマンドバッファ**: 容量 200 のリングバッファ（調整可）。メモリ保持（再読み込みで消える仕様）。
- **グローバル seq**: 変更系 API の成功時に受理順で採番（失敗時は列挙化エラーを投げる）。
- **Undo-as-a-Command**: 逆操作を新規コマンドとして push。

### 6.3.2 コマンド仕様（共通 Envelope）
```ts
// 共通項目
export type CommandGroupId = UUID;
export type CommandId = UUID;
export type Seq = number;

export interface CommandEnvelope<K extends string, P> {    
  commandId: CommandId;
  groupId: CommandGroupId;
  kind: K;
  payload: P;
  issuedAt: Timestamp;
  sourceViewId?: string;
  onNameConflict?: 'error' | 'auto-rename';
}
```

- すべてのコマンド（物理・論理）は super type として groupId を持つ。
- 同一 groupId の物理コマンド群で 1 つの論理コマンドを構成。

### 6.3.3 更新系（論理）コマンド
- createNode
  - create/discard/commit の working copy ライフサイクル
- updateNode
  - create/discard/commit の working copy ライフサイクル


* createNode
    * createWorkingCopyForCreate（Undo非対象）
      新規 treeNodeId を発行し、その値を workingCopyOf にもセット。
    * discardWorkingCopyForCreate（Undo非対象）
    * commitWorkingCopyForCreate（Undo対象）

* updateNode
    * createWorkingCopy（Undo非対象）
      編集対象ノードをスプレッド構文でシャローコピーし、treeNodeId を新規発行で上書き。
      workingCopyOf には編集対象ノードの treeNodeId をセットし、copiedAt に Date.now() をセット。
    * discardWorkingCopy（Undo非対象）
    * commitWorkingCopy（Undo対象）


```ts
// Worker exposed interface
export interface TreeMutationService {

  // ---- working copy ----
  createWorkingCopyForCreate(cmd: CommandEnvelope<'createWorkingCopyForCreate', {
    workingCopyId: UUID;
    parentTreeNodeId: TreeNodeId;
    name: string; // 正規化前可（Workerで正規化）
    description?: string;
  }>): Promise<void>;

  createWorkingCopy(cmd: CommandEnvelope<'createWorkingCopy', {
    workingCopyId: UUID;
    sourceTreeNodeId: TreeNodeId;
  }>): Promise<void>;

  discardWorkingCopyForCreate(cmd: CommandEnvelope<'discardWorkingCopyForCreate', {
    workingCopyId: UUID;
  }>): Promise<void>;

  discardWorkingCopy(cmd: CommandEnvelope<'discardWorkingCopy', {
    workingCopyId: UUID;
  }>): Promise<void>;

  commitWorkingCopyForCreate(cmd: CommandEnvelope<'commitWorkingCopyForCreate', {
    workingCopyId: UUID;
    onNameConflict?: OnNameConflict; // 既定: 'auto-rename'
  }>): Promise<{ seq: Seq; nodeId: TreeNodeId }>;

  commitWorkingCopy(cmd: CommandEnvelope<'commitWorkingCopy', {
    workingCopyId: UUID;
    expectedUpdatedAt: Timestamp; // 楽観ロック（元ノード）
    onNameConflict?: OnNameConflict;
  }>): Promise<{ seq: Seq }>;
}
```

### 6.3.4 更新系（物理）コマンド

* moveNodes
  移動（自己/子孫への移動禁止）
* duplicateNodes
  複製（新規ID発行、referredBy 未定義、自己/子孫への複製禁止）
* pasteNodes
  クリップボード貼り付け（新規ID発行、自己/子孫への貼り付け禁止）
* moveToTrash
  TrashRoot配下に移動（referredBy が空でない場合は失敗）
* permanentDelete
  TrashRoot配下から完全削除
* recoverFromTrash
  TrashRoot配下から復元（parentTreeNodeId を元に戻す）
* importNodes
  JSONインポート（新規ID発行）

```ts
  // ---- physical ops ----
  moveNodes(cmd: CommandEnvelope<'moveNodes', {
    nodeIds: TreeNodeId[];
    toParentId: TreeNodeId;
    onNameConflict?: OnNameConflict;
  }>): Promise<{ seq: Seq }>;

  duplicateNodes(cmd: CommandEnvelope<'duplicateNodes', {
    nodeIds: TreeNodeId[];
    toParentId: TreeNodeId;
    onNameConflict?: OnNameConflict;
  }>): Promise<{ seq: Seq; newNodeIds: TreeNodeId[] }>;

  pasteNodes(cmd: CommandEnvelope<'pasteNodes', {
    nodes: Record<TreeNodeId, TreeNode>; // クリップボード由来（新規ID採番）
    nodeIds: TreeNode[];
    toParentId: TreeNodeId;
    onNameConflict?: OnNameConflict;
  }>): Promise<{ seq: Seq; newNodeIds: TreeNodeId[] }>;

  moveToTrash(cmd: CommandEnvelope<'moveToTrash', {
    nodeIds: TreeNodeId[];
  }>): Promise<{ seq: Seq }>;

  permanentDelete(cmd: CommandEnvelope<'permanentDelete', {
    nodeIds: TreeNodeId[];             // TrashRoot 配下限定
  }>): Promise<{ seq: Seq }>;

  recoverFromTrash(cmd: CommandEnvelope<'recoverFromTrash', {
    nodeIds: TreeNodeId[];
    toParentId?: TreeNodeId;           // 未指定なら originalParentTreeNodeId
    onNameConflict?: OnNameConflict;
  }>): Promise<{ seq: Seq }>;

  importNodes(cmd: CommandEnvelope<'importNodes', {
    nodes: Record<TreeNodeId, TreeNode>; // JSONファイル由来（新規ID採番）
    nodeIds: TreeNode[];
    toParentId: TreeNodeId;
    onNameConflict?: OnNameConflict;
  }>): Promise<{ seq: Seq; newNodeIds: TreeNodeId[] }>;

  // ---- undo/redo ----  ※ メモリ・リングバッファ
  undo(groupId: CommandGroupId): Promise<{ seq: Seq }>;
  redo(groupId: CommandGroupId): Promise<{ seq?: Seq; ok: boolean }>; // 競合なら ok=false
  
}

```

### 6.3.5 非更新系コマンド

* copyNodes
* exportNodes

```ts
export interface TreeQueryService {
  copyNodes(cmd: CommandEnvelope<'copyNodes', {
    nodeIds: TreeNodeId[];
  }>): Promise<{seq: Seq}>;
  
  exportNodes(cmd: CommandEnvelope<'exportNodes', {
    nodeIds: TreeNodeId[];
  }>): Promise<{seq: Seq}>;
}
```
