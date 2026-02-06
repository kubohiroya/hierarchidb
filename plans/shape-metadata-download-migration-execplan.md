# Shape metadata download migration

このExecPlanは生きた文書であり、`Progress`・`Surprises & Discoveries`・`Decision Log`・`Outcomes & Retrospective`を常に更新する。`PLANS.md`（リポジトリ直下）に従って記述・更新すること。

## Purpose / Big Picture

fetch-save-metadata パッケージを完全に削除し、Shape Plugin の Step3 が `@hierarchidb/download` 経由で geoBoundaries / GADM のメタデータを取得・キャッシュできるようにする。geoBoundaries は `https://www.geoboundaries.org/api/current/gbOpen/ALL/ALL/` から一覧を取得し、GADM は `https://gadm.org/maps.html` から国名と ISO-3 を取得し、各国ページの GeoJSON レベル表記から利用可能な行政レベルを抽出する。Natural Earth は国選択不可のため「国なしでレベル0/1のみ選択可能」に変更し、OpenStreetMap は Step2 で選択不可のまま維持し、Step3 で値が来た場合は例外で停止させる。ユーザーは Step3 の国×行政レベル選択が新経路のデータで動いていることを確認できる。

## Progress

- [x] (2026-01-03 17:40 JST) ExecPlan を作成した。
- [x] (2026-01-03 18:05 JST) @hierarchidb/download に downloadText（条件付きキャッシュ対応）を追加した。
- [x] (2026-01-03 18:10 JST) Shape metadata ローダーを download 経由へ差し替え、geoBoundaries/GADM/NaturalEarth/OpenStreetMap の分岐を実装した。
- [x] (2026-01-03 18:12 JST) Step3/UI/Worker の OpenStreetMap 例外とメタデータ読み込みの挙動を更新した。
- [x] (2026-01-03 18:14 JST) fetch-save-metadata を削除し、関連スクリプト/alias/型宣言を整理した。
- [x] (2026-01-03 18:16 JST) メタデータ関連のユニットテストと URL 生成テストを更新した。
- [ ] 検証コマンド実行と TASKS.md の運用ログ/ロールバック記述を更新する（完了: なし／残り: 実行・追記）。

## Surprises & Discoveries

- なし（作業開始時点）。

## Decision Log

- Decision: geoBoundaries の国メタデータは `gbOpen/ALL/ALL` の一覧JSONから `boundaryISO` と `boundaryType` を収集して作る。
  Rationale: 公式の全件一覧APIが存在し、Step3の国×レベル可用性を一括で生成できるため。
  Date/Author: 2026-01-03 / Codex
- Decision: GADM の行政レベルは `maps.html` から辿る各国ページで `GeoJSON: level-0, level1, level2` の表記を正規表現で抽出する。
  Rationale: 要件で明示された構造に従い、追加依存なしで抽出できるため。
  Date/Author: 2026-01-03 / Codex
- Decision: Natural Earth は「Worldwide」1行の擬似国メタデータを返し、レベル0/1のみを提示する。
  Rationale: 国別にダウンロードする仕組みがなく、UI上の選択を最小単位で残すため。
  Date/Author: 2026-01-03 / Codex
- Decision: OpenStreetMap は Step3 で明示的に例外を投げる。
  Rationale: Step2 で無効化されているにもかかわらず入力が来た場合に即座に失敗させるため。
  Date/Author: 2026-01-03 / Codex

## Outcomes & Retrospective

- 未完了。実装完了時に目的との差分、残課題、学びを記載する。

## Context and Orientation

現在の Shape Plugin は `plugins/shape-plugin/src/services/metadata/MetadataLoader.ts` で `@hierarchidb/fetch-save-metadata/output/*.json` を静的 import し、Step3 の国メタデータや availability 計算に利用している。`useCountryMetadata`（`plugins/shape-plugin/src/ui/hooks/useCountryMetadata.ts`）は MetadataLoader を呼び出し、失敗時に SAMPLE_COUNTRIES を返す。`CountryAvailabilityResolver`（`plugins/shape-plugin/src/services/datasources/CountryAvailabilityResolver.ts`）も MetadataLoader を使って可用レベルを構築する。`@hierarchidb/download` には `downloadJson` があり、`cache: 'conditional'` 指定時は ETag/Last-Modified を使って再検証するが、テキスト（HTML）取得用のAPIは存在しない。

fetch-save-metadata パッケージ（`packages/fetch-save-metadata`）および `scripts/data-generation/generate-metadata.mjs` は GitHub raw JSON を再取得するだけで、公式データソースからの生成経路はない。削除する場合は `package.json` の `metadata:ensure` などのスクリプト、および `app/vite.config.ts` / `types/ambient-modules.d.ts` / `tsconfig.base.json` の alias を合わせて更新する必要がある。

## Plan of Work

まず `@hierarchidb/download` にテキスト取得のユーティリティを追加する。`downloadJson` と同じく `cache: 'conditional'` をサポートし、HTML取得に使える `downloadText` を提供する。実装は `packages//src/pluginDownloadRegistry.ts` に追加し、`packages//src/index.ts` で export する。レスポンスは `ArrayBuffer` を `TextDecoder('utf-8')` で文字列化し、Conditional fetch で 304 の場合はキャッシュを返す仕様に揃える。

次に Shape Plugin の MetadataLoader を静的 JSON import から `download` ベースに置き換える。`plugins/shape-plugin/src/services/metadata` 配下にデータソース別の取得関数を分離し、`MetadataLoader` がそれらを呼び出して `CountryMetadata[]` を返すようにする。geoBoundaries は `https://www.geoboundaries.org/api/current/gbOpen/ALL/ALL/` を `downloadJson` で取得し、配列の各レコードから `boundaryISO`（ISO-3）と `boundaryType`（ADMレベル）を収集し、ISO-3 ごとに利用可能レベルの集合を作る。国名は `boundaryName` / `shapeName` / `countryName` の順で読み取り、ISO-2 は `normalizeCountryCodeFormat(iso3, 'iso2')` で補完する。GADM は `https://gadm.org/maps.html` を `downloadText` で取得し、ISO-3 と国名、各国ページへのリンクを抽出する。各国ページは `downloadText` で取得し、`GeoJSON:` セクションから `level-0` などの数値を抽出して `availableAdminLevels` に変換する。Natural Earth は `CountryMetadata` を 1 件だけ返し（例: `countryCode: 'GLOBAL'`, `countryName: 'Worldwide'`, `availableAdminLevels: [0, 1]`）、OpenStreetMap は `MetadataLoader.loadMetadata` 時点で明示的に例外を投げる。

Step3 の UI/Worker については、`useCountryMetadata` が OpenStreetMap の例外を握りつぶさずに上位へ返すように修正し、SAMPLE_COUNTRIES のフォールバックが不要なケースを区別する。`CountryAvailabilityResolver` も OpenStreetMap を拒否するガードを入れ、意図しないフォールバックを防ぐ。Natural Earth の「国なし」扱いに合わせて、Step3 が 1 行だけを表示し admin level 0/1 を選択できることを確認する。

最後に fetch-save-metadata パッケージを削除し、関連するスクリプト・alias・型宣言・テストを整理する。`package.json` の `metadata:ensure` と `generate-*-metadata` 系スクリプトは削除し、`build:pre` / `dev:pre` / shape-plugin の `prebuild` から `metadata:ensure` を外す。`app/vite.config.ts` と `app/vite.config.min.ts` の metadata alias 登録を削除し、`types/ambient-modules.d.ts` と `tsconfig.base.json` の `@hierarchidb/fetch-save-metadata` alias を削除する。shape-plugin のテスト（`metadata-loader.unit.test.ts` など）も新しい download 経路に合わせて更新する。

## Concrete Steps

1) download パッケージに `downloadText` を追加し、export する。作業場所は `packages//src/pluginDownloadRegistry.ts` と `packages//src/index.ts`。
   期待する追加シグネチャ例:
     downloadText(pluginId: string, url: string, prefix: string, options?: DownloadJsonOptions, signal?: AbortSignal): Promise<string>

2) Shape Plugin の metadata 取得を download ベースに差し替える。作業場所は `plugins/shape-plugin/src/services/metadata/MetadataLoader.ts` と新規 helper ファイル（例: `plugins/shape-plugin/src/services/metadata/metadataSources.ts`）。
   - geoBoundaries: `downloadJson` + `cache: 'conditional'` を使用。
   - GADM: `downloadText` + `cache: 'conditional'` を使用。
   - Natural Earth: 擬似1行メタデータを返す。
   - OpenStreetMap: `throw new Error('OpenStreetMap is not supported in Step3')` を返す。

3) UI/Worker のガードを調整する。作業場所は `plugins/shape-plugin/src/ui/hooks/useCountryMetadata.ts` と `plugins/shape-plugin/src/services/datasources/CountryAvailabilityResolver.ts`。
   - OpenStreetMap を検知したら例外を上位に返す。
   - 例外時に SAMPLE_COUNTRIES を流さない条件分岐を入れる。

4) fetch-save-metadata を削除し、参照とスクリプトを整理する。
   - 削除対象: `packages/fetch-save-metadata/**`, `scripts/data-generation/generate-metadata.mjs`
   - 更新対象: `package.json`（`metadata:ensure` と `generate-*-metadata` を削除）
   - 更新対象: `app/vite.config.ts`, `app/vite.config.min.ts`, `types/ambient-modules.d.ts`, `tsconfig.base.json`
   - shape-plugin の `prebuild` から `metadata:ensure` を削除

5) テスト更新。
   - `plugins/shape-plugin/src/common/__tests__/unit/metadata-loader.unit.test.ts`
   - 必要に応じて download をモックして安定化させる。

## Validation and Acceptance

- Unit テスト: リポジトリルートで `pnpm --filter @hierarchidb/shape-plugin test -- --run metadata-loader` を実行し、新しい metadata 取得経路が期待通りに動くことを確認する。
- UI 手動確認（可能なら）: Shape Step3 を開き、geoBoundaries で国一覧とレベルが出ること、Natural Earth で国が 1 行のみ表示されレベル0/1が選択できること、OpenStreetMap を強制指定した場合に明示的なエラーが出ることを確認する。

## Idempotence and Recovery

- downloadText 追加と metadata 差し替えは繰り返し適用可能。fetch-save-metadata 削除は戻しにくいので、`git restore` で復元できるよう差分を小さく保つ。
- ロールバックは、`fetch-save-metadata` の復元と `MetadataLoader` の静的 JSON import への戻しで実現可能。`TASKS.md` に具体的な revert 対象ファイルを列挙する。

## Artifacts and Notes

- geoBoundaries の一覧 API は JSON 配列を返すため、取得後のログ例は以下のようになる想定:
    [MetadataLoader] geoboundaries entries: 200+ countries, max level 5
- GADM の HTML 解析は構造変更に弱い可能性があるため、解析に失敗した場合はエラーを明示し、Step3 でフォールバックを行わない。

## Interfaces and Dependencies

- 新規API: `downloadText`（`@hierarchidb/download`）
  - 入力: pluginId, url, prefix, options, signal
  - 出力: 取得した文字列
  - 仕様: `downloadJson` と同じく `cache: 'conditional'` をサポートし、ETag/Last-Modified を利用する。

- 新規関数群（Shape Plugin）:
  - `fetchGeoBoundariesMetadata(): Promise<CountryMetadata[]>`
  - `fetchGadmMetadata(): Promise<CountryMetadata[]>`
  - `fetchNaturalEarthMetadata(): Promise<CountryMetadata[]>`
  - `assertDataSourceSupported(dataSource: string): void`

これらを `MetadataLoader` が呼び出し、結果を in-memory cache に保持する。OpenStreetMap は `assertDataSourceSupported` で即時例外とする。

変更履歴: 2026-01-03 17:40 JST - 初版作成（fetch-save-metadata 削除と download 経由 metadata 取得の方針を反映）。
変更履歴: 2026-01-03 18:18 JST - downloadText 追加、metadata ローダー移行、fetch-save-metadata 削除の進捗を反映。
