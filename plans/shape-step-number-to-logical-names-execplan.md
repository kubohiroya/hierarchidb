# shape-plugin の step 番号命名を論理名へ置換する

本 ExecPlan は生きたドキュメントである。Progress / Surprises & Discoveries / Decision Log / Outcomes & Retrospective を常に更新する。

この plan はリポジトリ直下の `PLANS.md` に従って維持する。

## Purpose / Big Picture

shape-plugin 内の「step4/step5/step6」など物理的な番号を含むシンボル名やファイル名、i18nキー/UI文言は、仕様変更や順序変更に弱い。これらを論理名へ置換し、構造や意味で名前が安定する状態にする。変更後は、Step番号に依存しない名称になり、UIや機能の意味が伝わりやすくなる。確認は `pnpm --filter @hierarchidb/shape-plugin typecheck` の成功と、i18n/UI文言の置換を目視することで行う。

## Progress

- [x] (2026-01-29 07:59 JST) retired local task log にタスクを追加して着手ログを記載。
- [x] (2026-01-29 08:05 JST) step番号を含むシンボル/ファイル/i18nキー/UI文言の一覧を作成。
- [x] (2026-01-29 08:05 JST) 論理名の対応表を決定し、rename対象を確定。
- [x] (2026-01-29 08:05 JST) ファイル名・コンポーネント名・関数名・型名・i18nキー・UI文言を置換。
- [x] (2026-01-29 08:06 JST) `pnpm --filter @hierarchidb/shape-plugin typecheck` を実行。
- [x] (2026-01-29 08:06 JST) retired local task log に完了ログを記載しタスクを完了。

## Surprises & Discoveries

- Observation: まだなし。
  Evidence: なし。

## Decision Log

- Decision: stepフォルダ名は論理名へ置換する（step2→data-source、step3→country-selection、step4→build-config、step5→build-progress、step6→preview）。
  Rationale: UIの意味が読み取れる最小限の英語名に統一し、順序番号への依存を排除する。
  Date/Author: 2026-01-29 (Codex).
- Decision: Step4SectionTitle/getStep4HoverCardSx などの番号入りシンボルは BuildConfig に合わせて rename する。
  Rationale: build-config ステップ内に限定されるため、論理名で一貫させる。
  Date/Author: 2026-01-29 (Codex).
- Decision: README/TODO/設計ドキュメントの Step 記載は今回の対象外とする。
  Rationale: 要求範囲はシンボル/ファイル/i18n/UI文言であり、ドキュメント更新は別タスクで扱うため。
  Date/Author: 2026-01-29 (Codex).

## Outcomes & Retrospective

- Outcome: step番号を含むシンボル/ファイル/i18n/UI文言を論理名へ置換し、shape-plugin typecheck を通過した。ドキュメント内の Step 表記は対象外として残るため、必要なら別タスク化する。

## Context and Orientation

対象は `plugins/shape-plugin` 配下のみ。影響しうるのは以下の種類:

- UI コンポーネント/フック: `plugins/shape-plugin/src/ui/components/**`
- i18n: `plugins/shape-plugin/src/ui/locales/*.json`
- ルーティング/画面遷移/ラベル表示に紐づく文字列

このタスクでは、step番号が含まれる型名/関数名/コンポーネント名/ファイル名、i18nキー、UI表示文言を論理名へ置換する。番号付きの名称が残らないことが目標。

## Plan of Work

1) `plugins/shape-plugin` 配下で `step[0-9]` / `Step[0-9]` を含むシンボルやファイル名、i18nキー、文言を列挙する。
2) 列挙結果から論理名の対応表を作成し、置換の粒度を決める。たとえば Step4 は ConfigStep、Step5 は BuildStep、Step6 は PreviewStep など、意味に沿った名称にする。
3) 参照を壊さないようにファイル名・export/import・型名・関数名・コンポーネント名を置換する。i18nキーも同時に更新し、キー参照を一致させる。
4) UI表示文言に残る「Step4」等の表記を論理名へ更新する。
5) `pnpm --filter @hierarchidb/shape-plugin typecheck` を実行し、問題があれば修正する。
6) GitHub Issue に完了ログを記載する。

## Concrete Steps

- `rg -n "step[0-9]|Step[0-9]" plugins/shape-plugin` で一覧を作成。
- 論理名対応表を作成し、rename対象を明確化。
- ファイル名変更は `git mv` 相当で行い、import を更新。
- i18nキーは `plugins/shape-plugin/src/ui/locales/*.json` を更新。
- `pnpm --filter @hierarchidb/shape-plugin typecheck` を実行。

## Validation and Acceptance

- `pnpm --filter @hierarchidb/shape-plugin typecheck` が exit 0。
- `plugins/shape-plugin` 内に `step4/step5/step6` などの番号入りシンボル/ファイル名/i18nキー/UI文言が残らない。

## Idempotence and Recovery

置換は安全に再実行可能。問題があれば対象ファイルの変更を revert して元の名称に戻す。

## Artifacts and Notes

想定ログ:

  $ pnpm --filter @hierarchidb/shape-plugin typecheck
  ...
  Done in <N>s

## Interfaces and Dependencies

- shape-plugin 内の UI/Hook/worker の参照整合性を保つことが最重要。
- i18nキーの変更は参照側の同時更新が必須。

Plan updated on 2026-01-29 to capture validation completion and scope decisions.
