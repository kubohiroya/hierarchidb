vk:doc kind=guide audience=plugin-dev scope=entity-lifecycle

# プラグイン開発ガイド（Entity Lifecycle V2）

本ガイドは、プラグインが保持するエンティティ（Peer/Group/Relational）を、TreeNode のライフサイクルと安全に連動させるための実装方針・規約・移行手順をまとめたものです。

## 設計の基本原則

- 1ノード=1エンティティ原則（Peer）
  - PeerEntity の主キーは `nodeId`。専用の EntityId は不要。
  - 表示系（name/description）は TreeNode 側の責務。Entity はドメインデータのみを保持。
- Group/Relational は自然キーで一意に
  - GroupEntity: 主キーは `[nodeId + itemId]`。itemId は安定ID（Import/Duplicate で保持）。
  - RelationalEntity: 主キーは `[srcNodeId + type + dstNodeId]`（必要なら向き/メタを拡張）。
- 状態は TreeNode の位置で解釈
  - workingCopy/trash/通常の状態は、TreeNode の親ルート（workingCopyRoot/trashRoot/通常）で判定。
  - Entity 側に draft/removed などのフラグは持たない。
- すべての書き込みは CommandProcessor 経由
  - 1コマンド=1 Tx（`WORKER_TX_ENABLED`）で TreeNode と Entity を同一Txに束ねる。
  - 大量操作はバルク+チャンク（既定 50、`PERFORMANCE_CONFIG.BATCH_OPERATION_SIZE`）。

## データベース配置とテーブル設計（最終決定: A案）

- 各プラグインごとに独立した Dexie データベースを用意します（例: `<pluginName>-entities`）。
- その内部テーブル名は共通の論理名を採用します。
  - peerEntities: `&nodeId, updatedAt`
  - groupEntities: `&[nodeId+id], nodeId, id, updatedAt`
  - relations: `&[srcNodeId+type+dstNodeId], srcNodeId, dstNodeId, type, updatedAt`

これにより、共通 Handler/Repository/移行/テストユーティリティが横断的に利用でき、上位コードは DB 名に依存せず、テーブル名の共通化でシンプルに実装できます。

### Dexie スキーマ例（プラグイン側）

```ts
import Dexie, { Table } from 'dexie';
import type { PeerEntity } from '@hierarchidb/runtime-worker-worker/entity/store';

export class PluginEntitiesDB extends Dexie {
  peerEntities!: Table<PeerEntity<MyPeerData>, string>; // key=nodeId
  // groupEntities / relations はプラグインの型に合わせて定義

  constructor(name = 'my-plugin-entities') {
    super(name);
    this.version(1).stores({
      peerEntities: '&nodeId, updatedAt',
      // groupEntities: '&[nodeId+id], nodeId, id, updatedAt',
      // relations: '&[srcNodeId+type+dstNodeId], srcNodeId, dstNodeId, type, updatedAt',
    });
  }
}

// プラグイン固有のデータ型例
type MyPeerData = {
  schemaVersion: 1;
  domain: {
    title?: string;
    properties?: Record<string, unknown>;
  };
};

// Store 実装例（抜粋）
export const myPeerStore = {
  async get(nodeId) {
    return db.peerEntities.get(nodeId);
  },
  async put(entity: PeerEntity<MyPeerData>) {
    await db.peerEntities.put({ ...entity, updatedAt: Date.now() });
  },
  async delete(nodeId) {
    await db.peerEntities.delete(nodeId);
  },
};

// 登録例（nodeType ごとに登録）
import { storeRegistry } from '@hierarchidb/runtime-worker-worker/entity/store-registry';
storeRegistry.registerPeer<MyPeerData>('my-node-type', myPeerStore);
```

## コマンド連動（概要）

- createNode: 必要に応じて Peer/Group のデフォルトを生成。
- updateNode: 通常は Entity 変更不要（必要時のみ rename 等）。
- moveNodes: `nodeId` 不変 → Entity 操作不要。
- moveToTrash/recoverFromTrash: Entity 操作不要（位置で状態解釈）。
- duplicateNodes: NodeId マップに従い、Peer/Group/Relational をバルク複製（サブツリー内参照のみ複製）。
- pasteNodes: 新 NodeId に対する Entity をバルク作成。
- importNodes: 2パス（ID割当→実体/関係を適用）。スキップ集計（停止しない）。
- working copy:
  - createWorkingCopy: original の Entity を wcNodeId で複製（永続）。
  - commitWorkingCopy: wc→target にアップサート（Peer/Group）、Relational の ID 付け替え。完了後 wc 側 Entity を削除。
  - discardWorkingCopy: wc 側 Entity を削除。

## 旧実装からの移行（A案に基づく整理）

- PeerEntity の EntityId → NodeId へ統合（Peer専用の EntityId は廃止）。
- workingCopyOf/originalParentId/removedAt に依存した判定 → holder 名の decode または QueryAPI による位置ベース判定へ置換。
- Dexie 直接書込み → CommandProcessor 経由（Tx/履歴/監査の一貫性を確保）。
- DB配置: プラグインごとに独立 DB を作成し、内部テーブル名は共通論理名に統一（既存DBがある場合は移行スクリプトで再編）。

## アンチパターン（禁止）

- Entity に name/description 等の表示系属性を持たせる（TreeNode と責務が混線）。
- 旧メタ（workingCopyOf 等）を Entity 側に持ち込む（位置で判定する）。
- 逐次書込み（バルク/チャンク未使用）→大規模で性能劣化・一貫性低下。
