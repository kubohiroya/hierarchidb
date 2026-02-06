# LocationFeature の admin0 命名統一と countryCode/Name 撤去

この ExecPlan は living document であり、`Progress`、`Surprises & Discoveries`、`Decision Log`、`Outcomes & Retrospective` を作業の進行に合わせて更新し続ける必要がある。

リポジトリルートの `PLANS.md` に従ってこの文書を維持する。

## Purpose / Big Picture

LocationFeature のスキーマで混在している `countryCode/countryName` を `admin0Code/admin0Name` に統一し、UI でも重複するカラムを撤去する。これにより、admin0 の国・行政区の情報が一貫した命名で扱えるようになり、プレビューやメタデータ表示が混乱しない。変更後は、Location Preview の Snackbar と Metadata 表で admin0 名称が同一のキーで取得でき、`countryCode/countryName` 由来の重複表示が無くなる。

## Progress

- [x] (2026-02-01 11:00Z) ExecPlan を作成し、命名統一の影響範囲を整理した。
- [x] (2026-02-01 11:05Z) LocationFeature の型定義から `countryCode/countryName` を削除し `admin0Code/admin0Name` に統一した。
- [x] (2026-02-01 11:10Z) 正規化・CSV 解析・変換処理の `countryCode/countryName` 参照を `admin0Code/admin0Name` に置換した。
- [x] (2026-02-01 11:15Z) UI 表示（Location Preview Metadata/hover）で `countryCode/countryName` 列や参照を撤去し、admin0 表示に統一した。
- [x] (2026-02-01 11:20Z) `pnpm --filter @hierarchidb/location-api build` と `pnpm --filter @hierarchidb/location-plugin typecheck` を実行して通過した。

## Surprises & Discoveries

- Observation: LocationNearestPoint の countryName が LocationMapPreview（batch）側で参照されており、admin0Name へ置換が必要だった。
  Evidence: `LocationMapPreview.tsx` の typecheck エラー `Property 'countryName' does not exist on type 'LocationNearestPoint'.`

## Decision Log

- Decision: 既存の `countryCode/countryName` を削除して `admin0Code/admin0Name` のみに統一する。
  Rationale: admin0 と同義の情報が二重に存在し、UI で重複表示を引き起こしているため。
  Date/Author: 2026-02-01 / Codex

## Outcomes & Retrospective

LocationFeature の国情報が admin0 命名に統一され、Metadata 表の重複列が解消された。残課題はなく、必要な型チェックも通過した。

## Context and Orientation

このリポジトリの LocationFeature は `packages//src/locationTypes.ts` に定義される。`LocationPointProperties` が `LocationFeatureProperties` として再利用され、`LocationFeature` の `data` がこの型を持つ。現在は `countryCode/countryName` と `admin0Code/admin0Name` が同居しているため、UI 表示で重複が発生する。

UI 側では `plugins/location-plugin/src/ui/components/steps/LocationMapPreviewStep.tsx` が Location Preview の Metadata 表や Snackbar 表示を作っており、ここで `countryCode/countryName` を表示している箇所を `admin0Code/admin0Name` に置換する必要がある。Worker 側の正規化では `plugins/location-plugin/src/worker/normalizers.ts` などが LocationFeature の正規化を行うため、`countryCode/countryName` の読み書きがある場合は置換する。

本変更はスキーマの rename であり、型・データ変換・UI の参照が一貫していないと壊れるため、影響範囲を段階的に確認して修正する。

## Plan of Work

まず `packages//src/locationTypes.ts` の `LocationPointProperties` から `countryCode/countryName` を削除し、必要な箇所では `admin0Code/admin0Name` を正とする。次に、LocationFeature を生成・正規化する処理（`packages//src/ideGsmLocationCsv.ts`、`plugins/location-plugin/src/worker/normalizers.ts`、`plugins/location-plugin/src/services/pointFactories.ts` など）で `countryCode/countryName` を書き込んでいる箇所を `admin0Code/admin0Name` に置換する。最後に UI の Metadata 表と Snackbar 表示の参照先を更新し、`countryCode/countryName` のカラムを撤去する。

変更後は `pnpm --filter @hierarchidb/location-plugin typecheck` で型整合を確認し、必要に応じて `pnpm --filter @hierarchidb/location-api build` を実行して型出力を更新する。エラーが出た場合は参照漏れを洗い出して修正する。

## Concrete Steps

1) スキーマの rename
   - `packages//src/locationTypes.ts` の `LocationPointProperties` から `countryCode/countryName` を削除し、`admin0Code/admin0Name` を利用する前提にする。

2) 正規化/変換処理の置換
   - `plugins/location-plugin/src/worker/normalizers.ts` の `countryCode/countryName` を `admin0Code/admin0Name` へ変更する。
   - `packages//src/ideGsmLocationCsv.ts` や `plugins/location-plugin/src/services/pointFactories.ts` など `countryCode/countryName` を扱う箇所を `admin0Code/admin0Name` に置換する。

3) UI 表示の整理
   - `plugins/location-plugin/src/ui/components/steps/LocationMapPreviewStep.tsx` の Metadata 表の `countryCode/countryName` 列を撤去し、`admin0Code/admin0Name` のみ表示する。
   - Snackbar 表示の admin0 参照を `admin0Code/admin0Name` に統一する。

4) 検証
   - リポジトリルートで `pnpm --filter @hierarchidb/location-api build` を実行する（型変更があるため）。
   - `pnpm --filter @hierarchidb/location-plugin typecheck` を実行する。

## Validation and Acceptance

- Location Preview の Metadata 表に `countryCode/countryName` が表示されず、`admin0Code/admin0Name` のみ表示されること。
- Snackbar の admin0 表示が `admin0Code/admin0Name` 由来で正しく表示されること。
- `pnpm --filter @hierarchidb/location-plugin typecheck` が exit 0 で完了すること。

## Idempotence and Recovery

- 変更はコードの rename と参照先修正のみであり、再実行しても問題は起きない。
- 問題が発生した場合は該当差分を revert することで元の挙動に戻せる。

## Artifacts and Notes

  pnpm --filter @hierarchidb/location-api build
  ✔ [@hierarchidb/location-api] Build complete

  pnpm --filter @hierarchidb/location-plugin typecheck
  > tsc --noEmit
  (exit 0)

## Interfaces and Dependencies

- `LocationPointProperties`（`packages//src/locationTypes.ts`）のフィールド定義が最終的な契約になる。
- 変換処理は `plugins/location-plugin/src/worker/normalizers.ts` と `packages//src/ideGsmLocationCsv.ts` を優先的に修正する。
- UI 側の表示は `plugins/location-plugin/src/ui/components/steps/LocationMapPreviewStep.tsx` を更新する。

更新履歴: 2026-02-01 作成。admin0 命名統一の ExecPlan を追加。
