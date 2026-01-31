vk:task id=wc-entity-spec status=todo priority=P1 labels=worker,entity,draft,docs

# タスク: Entity Draft 仕様の確定（Peer/Group）

## 背景 / 目的
- TreeNode の WC と連動する形で、PeerEntity/GroupEntity の WC を同一テーブルで管理する新仕様を確定させる。

## スコープ（ドキュメントのみ）
- `docs/draft-entity-spec.md` のレビューと確定
- 依存ドキュメントへのリンク/注意事項の追記

## 主要決定点
- `draftId = (Tree WC child).nodeId` を 1:1 対応で採用
- Canonical と WC を同一テーブルで共存（`draftOf` / `isDraft`）
- 競合検出は `version` 比較（マージ UI は将来拡張）
- トランザクションは Tree 側と同一境界で実施

## チェックリスト
- [ ] フィールド/インデックスの妥当性（Dexie 的に実装可能）
- [ ] クエリ/ビューのガイドライン（WC 除外 or 優先の使い分け）
- [ ] コミット/破棄のアルゴリズム整合（Tree 側と一致）
- [ ] エッジケースの方針（原本移動/削除、同時編集）

## 依存関係
- Tree WC 仕様（3根/holder+child）
- CommandProcessor リファクタ計画
- Comlink 型強化（構造化クローン制約）
 - エピック: `epic-wc-trash-unification`

## 受け入れ基準
- 仕様のレビュー合意（このタスクは実装なし）
- 後続タスク（実装）へ 3–5 PR 単位で分割可能な形で明文化
