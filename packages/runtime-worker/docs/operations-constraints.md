vk:doc kind=guide audience=dev scope=worker

# Operations & Constraints（runtime-worker）

主な運用制約と設計根拠を簡潔にまとめます。

- Policy C（移動/削除ブロック）
  - 目的: サブツリーに Working Copy (WC) がある間の move/remove を禁止し、編集中の不整合を防ぐ。
  - 実装: `CommandProcessor` 入口で常時検査。`trees.draftRootId` → `nodes.where('parentId').anyOf(...)` → holder.name を decode → サブツリーID Set と突き合わせ。

- Trash（holder 方式）
  - 目的: Trash 復元・競合・参照整合性の取り扱いを単純化。
  - 仕様: trashRoot 直下の holder.name に `${originalParentId}\t${trashedNodeId}` を埋め込み、子に実体ノード。
  - 復元: holder decode で originalParent を取得し、子を移動後に holder を削除。
  - 実装は常時有効。従来の `removedAt` ベース実装は廃止済み。

- 名前衝突（onNameConflict）
  - 統一ポリシー: `'error' | 'auto-rename'`
  - auto-rename: `createNewName(siblingNames, baseName)` により `(n)` サフィックスで決定的に命名。

- エラーモデル（整流済み）
  - 採用: Core の `CommandResult` / `ErrorCode`
  - NAME_CONFLICT 相当は VALIDATION_ERROR にマップし、メッセージに候補名を含める。

- フラグ運用
  - 主要機能（Tx ラップ / コマンドメトリクス / Policy C / Trash holder）は常時有効です。
