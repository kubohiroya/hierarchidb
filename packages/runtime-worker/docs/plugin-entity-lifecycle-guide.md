# Plugin Entity Lifecycle Guide (TreeNode data/draftData Edition)

本ガイドは、PeerStore を前提とした旧版を置き換えるものです。現在は **TreeNode の data/draftData が唯一の SSOT** であり、PeerStore は廃止されています。

## 基本ポリシー

- **TreeNode data/draftData**: payload/draft を含む全てのプラグイン固有データは TreeNode に直接保持する。
- **PeerStore は使わない**: PeerStore を登録/取得する API は存在しない。
- **Group/Relation のみ Dexie**: 1:N / N:N の追加データが必要な場合のみ Dexie の Group/Relation store を登録する。

## 実装メモ

- **正規化**: normalize 関数は UI/Worker 側の更新フローで直接適用する。Store 登録は行わない。
- **Dialog state**: `TreeNode.dialogUIState` に保存し、TreeNode の更新で維持する。
- **Lifecycle**: create/commit/duplicate/paste/import は runtime-worker が TreeNode の data/draftData をコピーするのみ。

## Group / Relation を使う場合

Peer payload 以外に 1:N / N:N データを保持する必要があるプラグイン（location/shape 等）は引き続き Dexie ベースの Group/Relation store を登録する。

```ts
registry.registerGroup('location', createLocationGroupStoreDexie(db));
registry.registerRelations('location', createLocationRelationStoreDexie(db));
```

TreeNode の data/draftData とは別テーブルである点に注意してください。
