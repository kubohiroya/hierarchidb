# Location Step4 display config

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan must be maintained in accordance with `PLANS.md` in the repository root.

## Purpose / Big Picture

Location プラグインの Step4（Settings）で、表示設定を保存できるようにする。ユーザーは Area Centroid / Airport / Port / Station / Interchange ごとに、ズーム別の表示切替、アイコンの色・種類・サイズ、ラベルの色・サイズとズーム切替を指定できる。設定は LocationEntity に保存され、再オープン時に復元される。画面上では各設定の意味が i18n で説明される。動作確認は Step4 を開き、スライダーや色選択の変更が保存されることを確認することで行う。

## Progress

- [x] (2026-01-26 15:26 JST) LocationEntity に表示設定スキーマを追加し、UI から読み書きできる形にした。
- [x] (2026-01-26 15:27 JST) Step4 の UI に Representation / Icon / Label の各カードを追加し、i18n 文言を追加した。
- [x] (2026-01-26 15:28 JST) `pnpm --filter @hierarchidb/location-plugin typecheck` を実行し、結果を記録した。


## Surprises & Discoveries

- Observation: `@hierarchidb/location-store` は dist の d.ts を参照しているため、typecheck 前に `pnpm --filter @hierarchidb/location-store build` が必要だった。
  Evidence: location-store build を実行後に location-plugin typecheck が成功した。


## Decision Log

- Decision: Step4 の実装は `plugins/location-plugin/src/ui/components/steps/LocationBatchParametersStep.tsx` に追加する。
  Rationale: 現在の Step 構成では Settings がここにあり、ユーザーが Step4 と認識している画面と一致するため。
  Date/Author: 2026-01-26 / Codex

- Decision: LocationEntity には `representationByZoomLevelConfig` / `iconConfig` / `labelConfig` を追加する。
  Rationale: 要求で明示された 3 種の設定を分離し、読み書きの範囲を明確にするため。
  Date/Author: 2026-01-26 / Codex

- Decision: 4点スライダーの既定値は `tilesMaxZoom` を基準に自動補正して範囲外を避ける。
  Rationale: 共通ズーム設定の最大値に合わせる要求があるため、最大ズーム未設定でも安全に表示できるようにするため。
  Date/Author: 2026-01-26 / Codex

- Decision: アイコン選択は Material Icons の固定リスト（Public / LocationCity / FlightTakeoff / DirectionsBoat / Train / ForkRight）を提供し、保存は iconId 文字列で行う。
  Rationale: 既存の Location アイコンに合わせ、追加のアセットや依存を増やさずに選択 UI を提供できるため。
  Date/Author: 2026-01-26 / Codex

## Outcomes & Retrospective

表示設定のスキーマ追加と Step4 UI の追加が完了し、i18n 文言を追加した。location-store の build を実行して型出力を更新し、location-plugin の typecheck を通過した。描画ロジックへの反映は別タスクで検討する。


## Context and Orientation

LocationEntity は `packages//src/index.ts` に定義され、Location プラグインは `plugins/location-plugin/src/common/entities/LocationEntity.ts` から再 export している。Step4 の UI は `plugins/location-plugin/src/ui/components/steps/LocationBatchParametersStep.tsx` にあり、`useTranslation` で `plugins/location-plugin/src/ui/locales/en.json` と `plugins/location-plugin/src/ui/locales/ja.json` の文言を使用している。ここで “Step4” は Location の `getCreateStepConfigs()` における Settings を指す。共通ズーム設定の最大ズームは `LocationEntity.tilesMaxZoom` を参照し、未設定の場合は既定値を使う。

Representation は「点 → 拡大ポリゴン → 拡大アイコン → 固定サイズアイコン」へ切り替えるズーム閾値を 4 つ指定する設定である。Icon はアイコンの種類・色・サイズ範囲を指定する設定である。Label はラベルの色・サイズ範囲と、拡大表示を開始・固定化するズーム閾値を指定する設定である。

## Plan of Work

まず `packages//src/index.ts` に表示設定の型を追加し、LocationEntity に 3 つの設定フィールドを追加する。`LocationIconId` として使用可能なアイコン ID を列挙し、各設定を `LocationType` ごとの Record で定義する。次に `plugins/location-plugin/src/ui/components/steps/LocationBatchParametersStep.tsx` に 3 つのカード UI を追加する。`tilesMaxZoom` を最大値として使うため、`tilesMaxZoom` が未設定の場合の既定値を定義し、スライダー入力を範囲内に収める補正関数を用意する。Representation の 4 点スライダーは `[pointZoom, polygonZoom, iconZoom, iconFixedZoom]` の順序を維持する。Icon のカードでは色入力、アイコン選択、サイズ範囲スライダーを提供する。Label のカードでは色入力、ズーム範囲スライダー、サイズ範囲スライダーを提供する。変更内容は `onUpdate` を通じて `LocationEntity` のドラフトへ保存する。

最後に `plugins/location-plugin/src/common/i18n/index.ts` と `plugins/location-plugin/src/ui/locales/en.json` / `ja.json` に説明文とラベルを追加する。翻訳は英語/日本語で追加し、UI では各設定の意味が表示される。

## Concrete Steps

1) `packages//src/index.ts` に以下の型を追加し、`LocationEntity` に 3 つの新規フィールドを追加する。

   - `LocationRepresentationByZoomLevel` : 4 つのズーム閾値。
   - `LocationRepresentationByZoomLevelConfig` : `Record<LocationType, LocationRepresentationByZoomLevel>`
   - `LocationIconId` : 既定アイコンの ID。
   - `LocationIconConfig` : `Record<LocationType, { color: string; iconId: LocationIconId; sizeRange: [number, number]; }>`
   - `LocationLabelConfig` : `Record<LocationType, { color: string; zoomRange: [number, number]; sizeRange: [number, number]; }>`
   - `LocationEntity` に `representationByZoomLevelConfig`, `iconConfig`, `labelConfig` を追加する。

2) `plugins/location-plugin/src/ui/components/steps/LocationBatchParametersStep.tsx` に 3 つのカード UI を追加する。MUI の `Card` / `CardContent` / `Grid` / `Slider` / `Select` / `TextField` を使用する。

   - RepresentationByZoomLevelConfigCard
     - 4 点スライダーでズーム閾値を編集する。
     - スライダーは `min=0` `max=tilesMaxZoom` とする。
     - 各値の意味を `translations.processing?.representation?.values` から表示する。

   - IconConfigCard
     - 色入力 (`TextField type="color"`) を使って色を設定する。
     - アイコン選択は `Select` で `LocationIconId` の一覧から選択する。
     - サイズ範囲は `Slider` の range モードで 2 つの値を扱う。

   - LabelConfigCard
     - 色入力を用意する。
     - ズーム範囲は range slider で 2 つの値を扱う。
     - サイズ範囲も range slider で 2 つの値を扱う。

   - いずれも `LocationType` ごとの列を持ち、見出しには `translations.locationTypes?.[type]` を使う。
   - 既定値の生成は `tilesMaxZoom` を基準に補正する。例として `pointZoom=0`, `polygonZoom=maxZoom*0.4`, `iconZoom=maxZoom*0.6`, `iconFixedZoom=maxZoom*0.8` を切り上げ・切り捨てし、範囲外は 0..maxZoom にクランプする。

3) i18n を追加する。

   - `plugins/location-plugin/src/common/i18n/index.ts` の `LocationTranslations` と `baseTranslations` に新しいセクションを追加する。
   - `plugins/location-plugin/src/ui/locales/en.json` と `ja.json` にラベルと説明文を追加する。

4) 型チェックを実行する。

   - 実行ディレクトリ: リポジトリルート
   - コマンド: `pnpm --filter @hierarchidb/location-plugin typecheck`

## Validation and Acceptance

UI の確認として Step4 の Settings を開き、各 LocationType 行で 3 種の設定が編集できることを確認する。スライダーや色を変更した後、ダイアログを閉じて再度開き、値が保持されることを確認する。i18n の説明文が日本語/英語で表示されることを確認する。

テストは `pnpm --filter @hierarchidb/location-plugin typecheck` を実行し、exit 0 を確認する。必要なら `pnpm dev` で手動確認を行う。

## Idempotence and Recovery

スキーマ追加と UI 追加は再実行しても問題がない。問題があれば、変更したファイルの差分を revert すれば元に戻る。

## Artifacts and Notes

作業中に確認したログや差分は、このセクションに短く記録する。

## Interfaces and Dependencies

- `packages//src/index.ts` に新しい型と `LocationEntity` フィールドを追加する。
- `plugins/location-plugin/src/ui/components/steps/LocationBatchParametersStep.tsx` に UI を追加する。
- `plugins/location-plugin/src/common/i18n/index.ts` と `plugins/location-plugin/src/ui/locales/en.json` / `ja.json` に i18n を追加する。
- `LocationType` は既存の `'area_centroid' | 'airport' | 'port' | 'railway_station' | 'interchange'` を使用する。
- アイコンは `plugins/location-plugin/src/ui/components/steps/locationTypes.ts` の Material Icons に合わせて `LocationIconId` を定義し、UI で ID とアイコンを相互変換する。


変更履歴: 2026-01-26 JST - 実装完了に伴い Progress / Surprises / Outcomes を更新。
