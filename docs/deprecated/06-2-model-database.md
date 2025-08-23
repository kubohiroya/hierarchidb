## 6.2 データベースモデル

## 6.2.1 DB スキーマ（型）
- CoreDB（長命/原子性必要）
    - trees: &treeId, ほか Root/SuperRoot ID。
    - nodes: &treeNodeId, parentTreeNodeId, &[parentTreeNodeId+name]（兄弟名ユニーク）, [parentTreeNodeId+updatedAt], removedAt, originalParentTreeNodeId, *references。
    - rootStates: &[treeId+treeRootNodeType]。
- EphemeralDB（短命/高頻度）
    - workingCopies: &workingCopyId, workingCopyOf, parentTreeNodeId, updatedAt。
    - views: &treeViewId, updatedAt, [treeId+treeRootNodeType], [treeId+pageNodeId]。

代表クエリとインデックスの対応は 5.3 を参照。

## 6.2.3 DBマイグレーション方針
- DB スキーマ変更はバージョンで管理し、移行関数を実装。
- 破壊的変更は極力回避し、必要時はメジャーバージョンアップで告知。

## 6.2.4 一貫性と制約
- 保存時正規化: `normalize('NFC')(name).trim()`。
- 参照整合性: inbound refs のあるノードは Trash へ移動不可（エラー）。
- クロスツリー禁止: 親は同一 SuperRoot 系であること。

- **TreeNodeは兄弟名がユニーク**: 同一 parentTreeNodeId 配下で name はユニーク。


------
## 6.2.2 データモデル定義

### 6.2.2 Workerモジュールにおけるデータベース定義

Worker層におけるツリー格納用のデータモデル

#### 6.2.2.1 CoreDB（長命・原子性必要）
```ts
import Dexie, { Table } from 'dexie';

export type TreeRow = Tree;
export type TreeNodeRow = TreeNode; 
export type TreeRootStateRow = TreeRootState;

export class CoreDB extends Dexie {
  trees!: Table<TreeRow, string>;
  nodes!: Table<TreeNodeRow, string>;
  rootStates!: Table<TreeRootStateRow, [string, string]>;

  constructor(name: string) {
    super(`${name}-CoreDB`);
    this.version(1).stores({
      trees: '&treeId, treeRootNodeId, treeTrashRootNodeId, superRootNodeId',
      nodes: [
        '&treeNodeId',
        'parentTreeNodeId',
        '&[parentTreeNodeId+name]',
        '[parentTreeNodeId+updatedAt]',
        'removedAt',
        'originalParentTreeNodeId',
        '*references'
      ].join(', '),
      rootStates: '&[treeId+treeRootNodeType], treeId'
    });
  }
}
```

##### インデックス設計理由（重要ポイント）
* &treeNodeId … ノード主キー。
* parentTreeNodeId … 子一覧の取得・移動可否判定で高頻度に使用。
* &[parentTreeNodeId+name] … 兄弟名の一意性（重複名禁止）を安全に担保。
* [parentTreeNodeId+updatedAt] … 展開中枝の差分購読（指定Timestamp以降の更新）を効率化。
* removedAt, originalParentTreeNodeId … ゴミ箱の時系列表示と復元先特定に最適。
* references … ノードが参照しているノードIDの multiEntry インデックス。参照系機能や参照整合性チェックで使用。



#### 6.2.2.2 EphemeralDB（短命・高頻度）
```ts
export type WorkingCopyRow = WorkingCopy;
export type TreeViewStateRow = TreeViewState;

export class EphemeralDB extends Dexie {
  workingCopies!: Table<WorkingCopyRow, string>;
  views!: Table<TreeViewStateRow, string>;

  constructor(name: string) {
    super(`${name}-EphemeralDB`);
    this.version(1).stores({
      workingCopies:
        '&workingCopyId, workingCopyOf, parentTreeNodeId, updatedAt',
      views:
        '&treeViewId, updatedAt, [treeId+treeRootNodeType], [treeId+pageNodeId]'
    });
  } 
}
```

インデックス設計理由
* &[treeId+treeRootNodeType] … ツリー×ルート種別で 一意 に状態を特定。
* [treeId+pageNodeId] … 表示ページ単位の状態を逆引きして素早く取得。

代表的なクエリと対応インデックス（実装目安）
* 子ノード一覧
  nodes.where('parentTreeNodeId').equals(pid)
  → parentTreeNodeId

* 兄弟名のユニークチェック
  nodes.get({ parentTreeNodeId: pid, name })
  → &[parentTreeNodeId+name]（ユニークなので get 一発）

* 展開中枝の差分購読（Timestamp 以降）
  nodes.where('[parentTreeNodeId+updatedAt]').between([pid, ts], [pid, Dexie.maxKey])
  → [parentTreeNodeId+updatedAt]

* WorkingCopy → 元の探索
  workingCopies.where('workingCopyOf').equals(nodeId)
  → workingCopyOf

* Trash 一覧の時系列
  nodes.where('removedAt').above(0).reverse()
  → removedAt

* 参照整合性（remove前チェック）
  nodes.where('references').equals(targetId)（multiEntry）
  → *references

* ルート状態の取得
  rootStates.get([treeId, TreeRootNodeType.Root]) / rootStates.get([treeId, TreeRootNodeType.TrashRoot])
  → &[treeId+treeRootNodeType]
