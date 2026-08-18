# Split common-types into domain packages

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

PLANS.md はリポジトリ直下の `PLANS.md`。この ExecPlan は同ファイルの要件に従って更新・運用すること。

## Purpose / Big Picture

common-types に集約されている型を、実際に使われる文脈ごとのパッケージへ移設する。これにより、依存関係が明確になり、型の責務が分離され、最終的に common-types を廃止できる状態にする。実際の確認方法は、移設後に各パッケージの build/typecheck が通ること、および主要パッケージで common-types の import が残っていないことを確認すること。

## Progress

- [x] 2026-01-30 23:24 JST 目的と移設方針を合意し、ExecPlan 作成に着手。
- [ ] ExecPlan の初版を完成させ、移設対象の分類と順序を確定する。
- [ ] tag-api と core-types を新設し、tsconfig/exports を整備する。
- [ ] tree-api/tag-api/import-export-api/build-api/core-types へ型を移設し、参照先を切替する。
- [ ] common-types を再エクスポート専用に縮退する。
- [ ] 影響範囲の build/typecheck を実行し、通過ログを残す。

## Surprises & Discoveries

- Observation: まだなし。
  Evidence: N/A

## Decision Log

- Decision: Tag 系の型と API は tree-api から切り離し、tag-api を新設して移設する。
  Rationale: Tag は tree の補助機能ではあるが API と型の責務が独立しており、common-types の肥大化を防ぐために分離する方針が合意済み。
  Date/Author: 2026-01-30 / Codex

- Decision: 横断で不可欠な基盤型は core-types を新設して集約する。
  Rationale: id/primitive/entity/datasource は複数ドメインに跨るため、最小限の基盤パッケージとして切り出すのが循環依存の回避に有効。
  Date/Author: 2026-01-30 / Codex

## Outcomes & Retrospective

- 未記入。完了時に成果と残課題を記録する。

## Context and Orientation

common-types は `packages/common/types/src` にあり、以下のファイル群で構成される。

- action-types.ts
- api-types.ts
- command-types.ts
- commit-types.ts
- datasource.ts
- dialog-state.ts
- entity-types.ts
- id-types.ts
- id-util.ts
- import-export-types.ts
- menu-types.ts
- primitive-types.ts
- progress-types.ts
- tag-entity-types.ts
- task-queue-types.ts
- tree-node-event-types.ts
- tree-node-types.ts
- tree-root-node-types.ts
- tree-root-state-types.ts
- tree-types.ts
- undo-state-events.ts
- validation-types.ts

tree-api は `packages//src`、import-export-api は `packages//src`、build-api は `packages//src` に存在する。新設する tag-api は `packages//src`、core-types は `packages/core-types/src` とする。

本作業では、型定義を「利用文脈ごとのパッケージ」に移す。移設後は common-types を再エクスポート専用に縮退し、最終的に削除できる状態へ持っていく。再エクスポートは `src/index.ts` のみ許可というリポジトリ規約に従う。

## Plan of Work

まず、移設先の基本方針を反映する。tree 関連は tree-api へ、tag は tag-api へ、import/export は import-export-api へ、batch/queue/progress は build-api へ移設する。横断基盤型である id/primitive/entity/datasource は core-types に集約する。command/undo/commit は実際に使われる文脈に合わせて runtime/worker 側へ移設するが、現状は common-types 内にいるため、使用箇所の実態を確認し、移設先を確定する。

次に、新設パッケージ tag-api と core-types を作成する。tsconfig、package.json、exports、paths を整備し、dist 指向の型解決に合わせる。既存パッケージの tsconfig/base の paths に新規パッケージを追加し、必要に応じて依存関係も追加する。

その後、common-types から各型ファイルを移動する。移動後は、参照している import を新パッケージへ切り替える。tree-api から TagAPI/TagTypes を削除し tag-api に移動する。common-types 側は移行期間中、index.ts から新パッケージの再エクスポートのみ行い、実体は持たない形にする。

最後に、影響範囲の build と typecheck を実行し、dist 指向の運用に合わせて型生成が揃っていることを確認する。依存順の不整合があれば、Turbo dependsOn や project references の不足を補う。

## Concrete Steps

1. 影響範囲の利用箇所を検索し、移設先を確定する。
   例:
     rg -n "@hierarchidb/core-types" packages plugins app

2. tag-api を新設する。
   - ルート: `packages/`
   - `package.json`, `tsconfig.json`, `tsconfig.build.json`, `src/index.ts` を作成する。
   - `TagAPI.ts` と `TagTypes.ts` を tree-api から移動し、参照側の import を tag-api に変更する。

3. core-types を新設する。
   - ルート: `packages/core-types`
   - `id-types.ts`, `id-util.ts`, `primitive-types.ts`, `entity-types.ts`, `datasource.ts` を移動する。
   - 参照先を `@hierarchidb/core-types` へ変更する。

4. 既存の feature API に移設する。
   - tree-api: tree-node-* / tree-root-* / tree-types / tree-node-event-types / validation-types 等。
   - import-export-api: import-export-types。
   - build-api: task-queue-types / progress-types。

5. common-types を再エクスポート専用に縮退する。
   - `packages/common/types/src/index.ts` に各新パッケージからの export type を集約する。
   - 実体ファイルは削除し、再エクスポートのみが残る状態にする。

6. build/typecheck を実行し、通過することを確認する。
   例:
     pnpm --filter @hierarchidb/core-types build
     pnpm --filter @hierarchidb/tag-api build
     pnpm --filter @hierarchidb/tree-api build
     pnpm --filter @hierarchidb/import-export-api build
     pnpm --filter @hierarchidb/build-api build
     pnpm --filter @hierarchidb/core-types build
     pnpm --filter @hierarchidb/tag typecheck
     pnpm --filter @hierarchidb/plugin-base typecheck

## Validation and Acceptance

- common-types を直接 import している箇所が大幅に減少し、主要な型が各ドメインパッケージに移設されていること。
- 影響範囲の build/typecheck が exit 0 であること。
- tree-api から TagAPI/TagTypes が撤去され、tag-api に移動していること。
- core-types に id/primitive/entity/datasource が集約されていること。

## Idempotence and Recovery

各手順は複数回実行しても安全である。失敗時は移設したファイルを元のパッケージへ戻し、import の差分を revert すれば復旧できる。dist 指向運用のため、再実行時は build を先に行う。

## Artifacts and Notes

- 主要な検索結果、build/typecheck のログを GitHub Issue の運用ログに残す。
- 移設先の決定は Decision Log に追記する。

## Interfaces and Dependencies

- `@hierarchidb/tag-api` は TagAPI/TagTypes を提供し、tag 実装パッケージはこれを参照する。
- `@hierarchidb/core-types` は id/primitive/entity/datasource のみを提供し、他の API パッケージはこれに依存する。
- `@hierarchidb/tree-api` は tree に関わる型と API を提供し、UI/worker 系は tree-api に依存する。

---

Change log: 2026-01-30 23:24 JST 初版作成。common-types の分割方針と実行手順を明文化した。
