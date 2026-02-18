vk:task id=spec-freeze-wc-impl-align status=todo priority=P0 labels=worker,draft,docs,spec-freeze

# サブタスク: spec-freeze（holder-encoding / commit結果）

## 目的
- `wc-impl-align` 着手前に、実装に影響する仕様をピン留め（freeze）してブレを防ぐ。
- 対象は Holder 名称エンコード（v1）と `commitDraft` の戻りスキーマ（結果/エラー）。

## スコープ
- `docs/draft-holder-encoding.md` の v1 仕様を「固定化（freeze）」として明記（TAB区切り・IDにTAB禁止・encode/decode必須）。
- `docs/draft-ops-pseudocode.md` の `commit` 戻りスキーマを確定:
  - `ok | COMMIT_CONFLICT | NAME_CONFLICT` + メタ（`autoRenameTo?`, `originalVersion`, `wcVersion`）。
- `docs/draft-entity-spec.md` に commit の整合（Entity書き戻し/同一Tx/競合時の扱い）を擦り合わせ。
- `docs/draft-alignment-status.md` に freeze セクションを追記（対象/根拠/変更時の手続き）。

## 成果物
- 上記ドキュメントの修正PR（freezeマーカー、変更履歴の初期化）。
- 変更手続き（後方互換に影響する場合の承認フロー）を記載。

## 依存/関連
- 依存: `wc-spec-sync`（並行可）
- 関連: `wc-impl-align`（本サブタスク完了後に着手）
- エピック: `epic-wc-archive-unification`

## 受け入れ基準
- Holderエンコードv1と`commit`戻りの仕様が固定化され、影響範囲が明記されている。
- 以後のPRは freeze に準拠し、非互換は明示的に承認フローへ回す運用が文書化されている。

