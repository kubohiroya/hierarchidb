# Shape バッチ命名整理（build/vt/ephemeral への統一）

この ExecPlan は生きたドキュメントであり、`Progress`、`Surprises & Discoveries`、`Decision Log`、`Outcomes & Retrospective` は作業の進行に合わせて更新され続ける必要があります。

本計画はリポジトリ直下の `PLANS.md` に従って維持される必要があります。

## Purpose / Big Picture

Shape のバッチ処理（fetch/transform/vt）に関わる型名と API 名を、役割ではなくデータ内容に基づいた命名へ整理する。Input/Output/Source/Record/Row といった視点依存・多義的な語を排除し、`build`/`vt`/`ephemeral` を含む用語へ統一する。完了後は、`batch` 用語を排除して `build` に統一し、`ShapeVTMetadata` などステージ名と揺れのない語が採用される。

## Progress

- [ ] (2026-01-14) 対象スコープの型・API 一覧を確定し、改名ルールに照らした新名称案を確定する。
- [ ] (2026-01-14) plugin-service-api → runtime-worker → shape-plugin → shape-store の順に改名を適用する。
- [ ] (2026-01-14) UI 側の参照とテストの型参照を更新する。
- [ ] (2026-01-14) `pnpm --filter @hierarchidb/shape-plugin typecheck` と `pnpm --filter @hierarchidb/runtime-worker typecheck` を実行し、型の整合を確認する。

## Surprises & Discoveries

- Observation: 未記入
  Evidence: 未記入

## Decision Log

- Decision: Shape バッチ処理（fetch/transform/vt）に限定して命名整理を行う。
  Rationale: 影響範囲を限定し、段階的に命名の一貫性を確保するため。
  Date/Author: 2026-01-14 / Codex
- Decision: Input/Output を型名に含めず、データ内容を表すドメイン語で統一する。
  Rationale: 同一型が異なる視点で Input/Output と呼ばれる混乱を避けるため。
  Date/Author: 2026-01-14 / Codex
- Decision: Payload/Row キーワードは、その型が当該役割に限定される場合のみ使用する。
  Rationale: 汎用型に役割名を付けると誤解や再利用の阻害になるため。
  Date/Author: 2026-01-14 / Codex
- Decision: `batch` 用語は `build` に置換する（ShapeBuildSession など）。
  Rationale: このアプリではバッチ処理が build のためにのみ使われているため。
  Date/Author: 2026-01-14 / Codex
- Decision: Ephemeral API は `EphemeralShapeQueryAPI` / `EphemeralShapeMutationAPI` に統一する。
  Rationale: ShapeQueryAPI/ShapeMutationAPI と対になる命名に揃えるため。
  Date/Author: 2026-01-14 / Codex
- Decision: vector tile のメタデータ型は `ShapeVTMetadata` を使用し、`Info/Row` の揺れを排除する。
  Rationale: VT ステージの用語と揃え、メタ情報であることを明確化するため。
  Date/Author: 2026-01-14 / Codex
- Decision: `Source` は多義的なため、`TransformSource` など異なる文脈で使わない。
  Rationale: `DataSource` 以外の `Source` が混在すると理解が難しくなるため。
  Date/Author: 2026-01-14 / Codex

## Outcomes & Retrospective

- 未記入。作業完了時に記載する。

## Context and Orientation

Shape の build 処理は fetch/transform/vt の 3 ステージで構成される。タスク型は `packages/plugin-service-api/src/types/shapeBuildTypes.ts` を基準に worker/API/UI が参照する。実データは buffer ストアに保存され、タスク型は参照（バッファIDやメタ情報）を保持する。

ステージの位置づけ（意図の確認）:
- `ShapeFetchBuffer`: fetch ステージ出力（ダウンロード済みデータのバッファ）。
- `ShapeTransformBuffer`: transform ステージ出力かつ vt ステージ入力。

重要なファイル:

- `packages/plugin-service-api/src/types/shapeBuildTypes.ts` (タスク型、バッファ型、メタ型)
- `packages/plugin-service-api/src/types/ShapeQueryAPI.ts` / `ShapeMutationAPI.ts` / `EphemeralShapeQueryAPI.ts` / `EphemeralShapeMutationAPI.ts`
- `packages/runtime-worker/src/services/ShapeQueryService.ts` / `ShapeMutationService.ts`
- `plugins/shape-plugin/src/services/batch/ShapeBuildApiClient.ts`
- `plugins/shape-plugin/src/ui/components/step4/*`
- `plugins/shape-plugin/src/ui/components/step5/*`
- `plugins/shape-plugin/src/ui/components/step6/*`
- `packages/features/shape-store/src/ShapeDB.ts` / `packages/features/shape-store/src/EphemeralShapeDB.ts`

## Plan of Work

1. 変更対象の型・API の命名一覧を確定する。
2. `ShapeBatchSession` を `ShapeBuildSession` に変更し、`batch` 用語を `build` に置換する。
3. Ephemeral API を `EphemeralShapeQueryAPI` / `EphemeralShapeMutationAPI` に変更する。
4. `ShapeVTMetadata` へ統一し、`Info/Row` の揺れを排除する。
5. `Source` を避けた命名へ置換する（`DataSource` は維持）。
6. plugin-service-api → runtime-worker → shape-plugin → UI の順に参照を更新する。
7. 必要な export を `index.ts` に追記する。
8. typecheck を実行し、エラーを解消する。

## Validation and Acceptance

`pnpm --filter @hierarchidb/shape-plugin typecheck` と `pnpm --filter @hierarchidb/runtime-worker typecheck` を実行し、エラーがないことを確認する。必要に応じて `pnpm --filter @hierarchidb/app typecheck` を実行し、命名変更による未解決 import がないことを確認する。

## Idempotence and Recovery

命名変更はリネーム中心のため、途中で失敗しても再実行可能。型名の更新漏れは typecheck で検出される。ロールバックする場合は変更差分を revert し、以前の型名に戻す。

## Artifacts and Notes

- 変更後の型名一覧をこのセクションに追記する。

## Interfaces and Dependencies

- 主要インターフェース: `ShapeQueryAPI`, `ShapeMutationAPI`, `EphemeralShapeQueryAPI`, `EphemeralShapeMutationAPI`
- 型定義: `shapeBuildTypes.ts` のタスク型・バッファ型・メタ型
- 依存箇所: runtime-worker の query/mutation、shape-plugin の batch API と Step4/Step5/Step6 UI

---

変更履歴:
- 2026-01-14: 再編。batch→build、Ephemeral 命名、VT Metadata、Source 多義性の排除方針を反映。
