# Styler feature-state 対応と resolver-plugin 非表示

この ExecPlan は生きた文書であり、`Progress`、`Surprises & Discoveries`、`Decision Log`、`Outcomes & Retrospective` を作業に合わせて更新する。ルートの `PLANS.md` の要件に従って維持する。

## Purpose / Big Picture

ユーザーは Styler で「テーブルのキーと地図上の feature ID を紐づけ、feature-state を通じて色・線幅・アイコンサイズを動的に反映」できるようになる。/map のフォルダプレビューで shape/location/route を選択して反映でき、resolver-plugin は UI の Create/SpeedDial メニューに表示されない。これにより事前埋め込みなしで大量 feature のスタイルを更新できる。

## Progress

- [x] (2025-12-27 17:55 JST) ExecPlan 作成と関連ファイルの現状把握を完了。
- [x] (2025-12-27 18:35 JST) styler-plugin のデータモデルと UI ステップ構成を feature-state 前提に再配置した。
- [x] (2025-12-27 18:40 JST) /map の vector tile レイヤーに promoteId と feature-state 適用導線を追加した。
- [x] (2025-12-27 18:42 JST) resolver-plugin をメタデータ `hidden` で非表示にし、メニュー側で反映した。
- [ ] 代表検証（typecheck 等）を実施し、結果を記録する。

## Surprises & Discoveries

- なし（未記録）。

## Decision Log

- Decision: resolver-plugin の非表示は `manifest.visibility.hidden` を新設し、メニュー側で除外する。
  Rationale: 既存の `creatable` はメニュー側に反映されておらず、明示的に非表示条件を設ける必要がある。
  Date/Author: 2025-12-27 / Codex

## Outcomes & Retrospective

- 未記録（作業完了後に更新）。

## Context and Orientation

本リポジトリでは Styler が表データを MapLibre へ反映するための設定を保持する。現状は `plugins/styler-plugin/src/services/StylerDataService.ts` で `['get', valueColumn]` を使った MapLibre 式を生成し、`app/src/router/routes/map.tsx` で styler の `generatedStyle.maplibreStyleSpec.layers[].paint` を /map に直接マージしている。

feature-state は MapLibre の機構で、`map.setFeatureState({ source, id }, state)` を使って feature に対して動的な値を紐づけ、`['feature-state', 'key']` を style expression で参照できる。vector tile では `promoteId` を指定して feature の ID を properties から生成する必要がある。

/メニュー非表示は `app/src/plugin-loaders/menu-builders.ts` が `getInstalledPlugins()` の戻りを元に構成しており、ここに manifest の `visibility` を反映させる必要がある。`packages/plugin-registry/src/types.ts` の `PluginManifest` 型には visibility が無い。

主要ファイル:
- Styler 型定義: `plugins/styler-plugin/src/common/types/StylerEntity.ts`
- Styler UI ステップ: `plugins/styler-plugin/src/ui/components/steps-provider.tsx`
- Styler マッピング UI: `plugins/styler-plugin/src/ui/components/StylerTargetStep.tsx`
- Styler プレビュー: `plugins/styler-plugin/src/ui/components/StylerPreviewStep.tsx`
- Map プレビュー: `app/src/router/routes/map.tsx`
- Vector tile レイヤー: `packages/ui/map/src/components/VectorTileLayer.tsx`
- Map コンポーネント: `packages/ui/map/src/components/ResourceLayerMap.tsx`
- Plugin registry 型: `packages/plugin-registry/src/types.ts`
- メニュー構築: `app/src/plugin-loaders/menu-builders.ts`
- resolver manifest: `plugins/resolver-plugin/package.json`

## Plan of Work

Styler の設定を feature-state 前提で再構成し、/map の描画で feature-state を適用する。作業は A 案（styler 単独）を前提とし、resolver 機能の導入は行わない。

1. Styler 型と UI を拡張する。`plugins/styler-plugin/src/common/types/StylerEntity.ts` に feature-state 用の設定を追加し、以下を保持できるようにする。
   - featureIdProperty: vector tile 側の property 名（promoteId に使用）
   - styleType: choropleth / points / lines（shape/location/route の選択に対応）
   - valueType: number / color（feature-state に入れる値の型）
   - mappingMode: map-interpolate / precomputed（number のときのみ）
   - valueRange / sizeRange: line-width / circle-radius 用の範囲

2. ステップ構成を再配置する。`plugins/styler-plugin/src/ui/components/steps-provider.tsx` を以下の 6 ステップ構成に変更し、各ステップに対応する UI を作る。
   - Step1 Data Source（既存の TabularDataSourceStep）
   - Step2 Filter（既存の StylerFilterStep）
   - Step3 Mapping Keys（Key Column / Value Column / Feature ID Property）
   - Step4 Target & Behavior（StyleType / TargetProperty / ValueType / MappingMode）
   - Step5 Scale / Style（Algorithm / Palette / 数値レンジ）
   - Step6 Preview（既存プレビューの拡張）

3. Styler から feature-state 用の辞書を作る。`StylerPreviewStep.tsx` の `styleKeyValues` を、feature-state に使う値と ID のペアとして使い続ける。`valueType` と `mappingMode` を考慮し、color/number を正しく保存する。MapLibre 側に渡す式は `['feature-state', 'value']` に統一し、Map への反映は /map 側で行う。

4. /map の描画に feature-state を適用する。`ResourceLayerMap` と `VectorTileLayer` を拡張し、以下を可能にする。
   - Vector tile source に `promoteId` を設定できるようにする。
   - map load 後に `setFeatureState` を使い、styler の key/value を sourceId + featureId に紐づける。
   - style overrides は `['feature-state', 'value']` 参照の式を優先し、従来の `get` 式は残す。

5. resolver-plugin を非表示にする。`packages/plugin-registry/src/types.ts` の `PluginManifest` に `visibility?: { hidden?: boolean }` を追加し、`plugins/resolver-plugin/package.json` の `hierarchidb.plugin.visibility.hidden` を true に設定する。`app/src/plugin-loaders/menu-builders.ts` で hidden を検知して除外する。

6. i18n の文言を追加・更新する。`plugins/styler-plugin/src/ui/locales/ja.json` と `plugins/styler-plugin/src/ui/locales/en.json` に新ステップ・新項目のラベルを追加する。

## Concrete Steps

1. `plans/styler-feature-state-execplan.md` を更新し、調査や決定事項を `Progress` と `Decision Log` に追記する。
2. `plugins/styler-plugin/src/common/types/StylerEntity.ts` を編集し、feature-state 用の設定型と既定値を追加する。
3. `plugins/styler-plugin/src/ui/components/steps-provider.tsx` を編集し、ステップ構成を A 案に再配置する。
4. `plugins/styler-plugin/src/ui/components` に Step3/Step4/Step5 用の UI を追加する（既存の StylerTargetStep は分割・再利用）。
5. `plugins/styler-plugin/src/ui/components/StylerPreviewStep.tsx` を編集し、feature-state 用の key/value 保存とプレビュー要約を追加する。
6. `app/src/router/routes/map.tsx` で styler の設定を読み込み、feature-state 反映のための source/target 情報を組み立てる。
7. `packages/ui/map/src/components/ResourceLayerMap.tsx` と `packages/ui/map/src/components/VectorTileLayer.tsx` に promoteId と feature-state の反映導線を追加する。
8. `packages/plugin-registry/src/types.ts` と `plugins/resolver-plugin/package.json` を編集し、hidden メタデータを追加する。
9. `app/src/plugin-loaders/menu-builders.ts` で hidden を見て除外する。
10. i18n リソースを追加する。

## Validation and Acceptance

- `pnpm --filter @hierarchidb/styler-plugin typecheck` を実行しエラーが出ないことを確認する。
- `pnpm --filter @hierarchidb/app typecheck` を実行し、UI 側で型エラーがないことを確認する。
- アプリを起動し /map にて、styler の設定で shape/location/route を選択し、feature-state が反映されることを確認する。確認の観点は「ID プロパティ名を変えると色/幅/サイズが変わる」「未設定時はデフォルト色に戻る」。

## Idempotence and Recovery

- 変更は additive を優先し、feature-state 未設定時は従来の styleOverrides を使う。
- ロールバックは styler の UI/型変更、map 反映、manifest 変更を revert すれば元に戻る。

## Artifacts and Notes

- 実装後に、/map で feature-state が反映されたスクリーンショットやログの要点を簡潔に記載する。

## Interfaces and Dependencies

- MapLibre の `promoteId` と `setFeatureState` を使う。promoteId は vector tile source に指定するプロパティ名で、feature の ID を決定する。
- `ResourceLayerMap` は vector layer 設定に promoteId/featureState を受け取り、`VectorTileLayer` へ渡す。
- Styler の feature-state 値は `styleKeyValues` を使って保持する。

---
更新メモ: 初版として feature-state 対応と resolver-plugin 非表示の方針を記載。
更新メモ: 進捗の記録と実装完了項目のチェック更新を追加。
