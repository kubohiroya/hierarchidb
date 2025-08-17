
## 7.2 TreeTable 



## UIデザイン

## ２つのツリーと２つのモード

### Resources

### Projects

### Root

### Trash

## 機能概要

### SpeedDial
### ツールバー
### クリックメニュー
### 行くリック

## ユーザストーリー


```ts
type TreeViewState = {
  treeViewId: UUID;
  treeId: TreeId;
  treeRootNodeType: TreeRootNodeType;
  pageNodeId: TreeNodeId;
  selected: Set<TreeNodeId>;
  columnWidthRatio: number[];
  columnSort: (null|"asc"|"dec")[];
  treeNodes: Record<TreeNodeId, TreeNodeWithChildren>;
  expanded: Record<TreeNodeId, boolean>;
  version: number;
  updatedAt: Timestamp;
};
```
