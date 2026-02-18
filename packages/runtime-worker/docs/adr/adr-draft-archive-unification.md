vk:adr id=adr-draft-archive-unification status=accepted

# ADR: Draft/Archive の holder 方式への統一（エンコード/Tx/ポリシーCの確定）

## 状態
accepted

## 文脈（Context）
- Draft は `draftRoot` 直下に holder+child のペアで表現する実装方針が先行し、Archive はノード自身に `originalParentId`/`originalName` を保持して `archiveRoot` 直下へ物理移動する方式が混在していた。
- UI/運用上の要請（名前衝突の単純化、復元/コミットの共通化、未保存作業の保護）から、Draft と Archive の内部表現と探索パターンを統一する必要がある。
- 既存の方針（単一WC共有、ポリシーC）と、holder.name の一意エンコード規約（v1）を前提に、Tx一貫性（同一Txで holder+child+エンティティの整合を保つ）を明文化する。

## 決定（Decision）
- 表現統一: Draft/Archive ともに「特別ルート直下の holder ノード + その直下に child 1件（実体）」のペアで表現する。
  - holder は `draftRoot` または `archiveRoot` の直下にのみ存在。
  - child は常に1件（0件/2件以上は不正）。
- エンコード（v1）: holder.name は TAB 区切り（U+0009）で親IDと対象IDを一意に表す。
  - Draft: `${targetParentNodeId}\t${targetNodeId}`（編集WC=既存 target、ドラフトWC=新規採番 target）。
  - Archive: `${originalParentNodeId}\t${archiveedNodeId}`（復元先の決定に使用）。
  - v1 では NodeId に TAB を含めない。v2 以降で `v2:<b64(parent)>:<b64(target)>` 等へ拡張可能。
- 単一WC共有: 原本（または予定 targetId）あたり WC は常に1つ。get-or-create で既存を返す。
- ポリシーC: 対象サブツリーに WC がある間は移動/削除をブロック。判定は holder.name の要素で行う。
- Tx一貫性: 以下を同一トランザクション境界で行い、途中失敗時は全体ロールバックする。
  - create: holder 作成 → child 作成（Entities がある場合は WC 側へ書く）
  - commit: 楽観ロック検証 → 原本へ反映 or 新規作成（名前衝突は auto-rename）→ WC エンティティの書戻し → holder/child のクリーンアップ
  - discard/restore: child/holder の削除や移動をまとめて適用

## 例外規定（Exceptions）
- ID仕様: v1 では NodeId に TAB を含めない（validation で拒否）。将来の v2 でエンコード方式を切替可能。
- 管理オペレーション: 破損データ修復/GC は管理者専用の強制オペレーションで例外的にポリシーCをバイパス可（監査ログ必須）。
- 互換読み: 移行期間中は Archive の旧方式（ノード本体に `originalParentId` 等を保持）も読み取り互換を維持し、書き込みは holder 方式のみとする。
- 分散Tx: ブラウザ内 CoreDB と Worker 内 EphemeralDB を跨ぐ分散トランザクションは行わない。コミットは「CoreDB 内単一Tx」を原則とし、UI通知は別チャネルで行う。

## 影響範囲（Consequences / Impact）
- runtime-worker: holder エンコード/デコードのユーティリティを単一実装へ集約し、Draft/Archive の CRUD/探索/ガード判定を同パターンに統一。`[parentId+name]` インデックスの利用を徹底。
- ui（runtime-ui, app）: 
  - ブロック理由（ポリシーC）の明示、編集再開導線（配下WCの一覧/ジャンプ）を提供。
  - ドラフト/復元の自動リネーム結果（`autoRenameTo`）を受け取り表示。
  - 更新通知（原本の `version` 変化）に基づく競合解消UIを維持。
- backend: 
  - サーバ同期/エクスポート時の holder ノード扱いを仕様化（特殊ルート直下でのみ許可）。
  - 将来のサーバサイド commit API は単一Tx（DB側）で一貫性を担保し、イベント/監査を同一境界で記録。

## 移行方針（Migration Plan）
1) ユーティリティ集約: `holder-encoding` を共通化（encode/decode/validate）。全呼び出しを置換。
2) Draft 側アライン: 既存実装をドキュメント準拠に確認（get-or-create/単一性/楽観ロック）。
3) Archive 統合（behind-the-flag）: holder 方式で作成/復元を実装し、旧フィールドの書き込みを停止。読みは両対応。
4) ガード適用: ポリシーC を CommandProcessor レイヤで一貫適用（移動/削除の前判定）。
5) UI 更新: ブロック時の理由表示/編集再開/名前自動変更の表示・取り消し導線。
6) クリーンアップ: 旧 `originalParentId`/`originalName` の段階廃止（マイグレート or lazy cleanup）。メトリクス/GC/監査を更新。

## 関連/参照（References）
- `docs/holder-pair-pattern.md`
- `docs/draft-holder-encoding.md`
- `docs/draft-ops-pseudocode.md`
- `docs/adr/adr-single-draft-per-target.md`
- `docs/adr/adr-block-move-delete-when-wc-in-subtree.md`

## 受け入れ基準（Acceptance Criteria）
- ポリシーC・単一WC共有・一意エンコード（v1）・Tx一貫性の根拠と例外規定が本ADRに明文化されている。
- 影響範囲（runtime-worker, ui, backend）と移行方針が列挙されている。
- ドキュメント整合（関連mdの参照更新）が完了している。
- レビュー合意: 2 名以上の承認をもって `accepted` とする（本ADRはこれを反映）。

