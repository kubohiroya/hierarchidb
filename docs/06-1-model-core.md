# 6. モデル

本章では、アプリ全体で共有されるデータモデル・定数・ユーティリティ、命名/型安全ポリシー、DB スキーマ型とマイグレーション方針をまとめる。

## 6.1 コア（core モジュール）

- 目的
  - アプリ全体で共通して利用する型定義・定数・ユーティリティ関数を提供。
  - TreeやTreeNodeの基本スキーマ、コマンド型、DBスキーマ定義を含む。

- 機能要件
  - Dexieスキーマ定義（CoreDB/EphemeralDB）。
  - Tree/TreeNode/TreeRootState/TreeViewStateの型定義。
  - コマンド種別・プロパティの型安全な定義。
  - 共通ユーティリティ（ID生成、時刻取得、名前正規化）。

- 実装上のポイント
  - `Entity` 用語は使用せず、シンプルな型名を採用（例：TreeNode）。
  - 型と定数はexportし、ui/workerモジュール双方で利用可能にする。
  - DBスキーマ変更は必ずバージョン管理し、マイグレーション関数を実装。

- 役割
  - UI/worker/api から共通利用される型・列挙・ユーティリティを提供。
  - DB スキーマの型（CoreDB/EphemeralDB の行型）を定義。

### 6.1.1 データモデル（抜粋）


#### 6.1.1.1 基本型

- 基本型は core モジュールが提供する Opaque/Branded 型を利用し、外部（UI/Worker/API呼び出し側）では string の具体型を直接扱わない。

- -用語と関係:
  - UUID: 体系内で用いる一意識別子（opaque）
  - TreeId: ツリー識別子（opaque）
  - TreeRootNodeType: 列挙型。値は SuperRoot / Root / TrashRoot（文字列リテラルの直書きは非推奨）
  - TreeNodeType: 列挙型。TreeRootNodeType に folder/file を加えた上位集合
  - SuperRootNodeId: SuperRoot 用 ID（opaque）
  - RootNodeId: Root 用 ID（opaque）
  - TrashRootNodeId: TrashRoot 用 ID（opaque）
  - TreeRootNodeId: SuperRootNodeId | RootNodeId | TrashRootNodeId（共用体）
  - RegularNodeId: 一般ノード（非ルート）用 ID（opaque）
  - TreeNodeId: TreeRootNodeId | RegularNodeId（共用体）
  - Timestamp: 数値時間（number）。IDとは異なり opaque ではない

#### 6.1.1.2 ツリー構造関係データモデル

- Tree/TreeNode（要点）
  - Tree は treeId と各 Root 系 ID（Root/Trash/SuperRoot）を持つ。
  - TreeNode は以下を保持: treeNodeType, treeNodeId, parentTreeNodeId, name, createdAt, updatedAt, version。
  - 拡張: hasChild, references, TrashItemProperties（originalParentTreeNodeId/removedAt 等）。
  - 同一 parentTreeNodeId 配下で name はユニーク（兄弟名ユニーク制約）。


```ts
type Tree = {
  treeId: TreeId;
  treeRootNodeId: RootNodeId;           // Root 専用ID
  treeTrashRootNodeId: TrashRootNodeId; // TrashRoot 専用ID
  superRootNodeId: SuperRootNodeId;     // e.g., `superroot:${treeId}`
};
// Root/TrashRoot の parentTreeNodeId は必ず superRootNodeId
// SuperRoot の TreeNode 実体は存在しない（内部専用・UI 非表示）

type TreeNodeBase = {
  treeNodeType: TreeNodeType;
  treeNodeId: TreeNodeId;               
  parentTreeNodeId: TreeNodeId;         
  name: string;                         
  description?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp; 
  version: number;
};

type DescendantProperties = {
  hasChild: boolean;
};

type ReferenceProperties = {
  references?: TreeNodeId[];
};

type TrashItemProperties = {
  originalName: string;
  originalParentTreeNodeId: TreeNodeId;
  removedAt: Timestamp;
};

type TreeNode =
& TreeNodeBase
& ({} | ReferenceProperties)
& ({} | TrashItemProperties);
```

#### 6.1.1.3 ルートごとのツリー開閉状態

  - TreeRootState: ルートごとの展開状態（expanded は true または Record）。

```ts
type TreeRootState = {
  treeId: TreeId;
  treeRootNodeType: TreeRootNodeType;
  expanded: true | Record<TreeNodeId, boolean>;
};
```
* expandedがtrueの場合には、すべてのノードが開いた状態であることを表す。
* expandedがRecordの場合には、エントリーのメンバーのノードの開閉状態を表すものとする。

#### 6.1.1.4 ツリー開閉状態の変化通知データモデル

- ExpandedStateChanges, SubTreeChanges: 差分通知のペイロード。

```ts
type ExpandedStateChanges = {
  treeId: TreeId;
  treeRootNodeId: TreeRootNodeId;
  pageNodeId: TreeNodeId;
  changes: true | Record<TreeNodeId, boolean|null>;
  version: number;
}
```
* changesの値が、expandedの値にマージされる。
* changesのRecordの値がnullの場合は、当該ノードが削除されたことを表すものとする。


#### 6.1.1.5 ツリー状態変化通知データモデル
```ts
type SubTreeChanges = {
  treeId: TreeId;
  treeRootNodeId: TreeRootNodeId;
  pageNodeId: TreeNodeId;
  changes: Record<TreeNodeId, (TreeNodeWithChildren|null)>;
  version: number;
}
```
* changesのキーとなるTreeNodeIdは、pageNodeIdのノード自身およびその直系の先祖ノードを含むものとする。また、pageNodeIdのノードの下位のノードのうち開状態のノードを含むものとする。
* changesの値が、UI側で保持されるツリー状態の値にマージされる。
* changesのRecordの値がnullの場合は、当該ノードが削除されたことを表すものとする。
