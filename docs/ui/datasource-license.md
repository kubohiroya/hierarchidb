# Shared Data Source & License Steps

最終更新: 2025-10-06

## 背景

- Shape / Location / Route いずれのプラグインでも、ダイアログ 2〜3 ステップ目に「データソース選択」「ライセンス承認」の UI が存在する。
- 現状はプラグインごとに実装がばらばら（mock データ, translation, Draft 反映パターンなどが散らばっている）。
- Draft リファクタとダイアログ再設計を進める上で、UI とロジックを共通コンポーネント化した方が保守しやすい。

## 目標

1. `packages/ui/datasource` に共通の `DataSourceSelector` を提供し、各プラグインからデータソース定義を渡すだけで利用できるようにする。
2. `packages/ui/license` に共通の `LicenseAgreementStep` を提供し、ライセンス文言・リンクの扱いを統一する。
3. Draft への書き込み（`dataSource`, `licenseAgreement`, `licenseAgreedAt` など）を小さなヘルパーに抽出し、UI から直接トップレベルを書き換えない構造へ寄せる。

## 既存実装の調査メモ

| プラグイン | データソースステップ | ライセンスステップ | 課題 |
| --- | --- | --- | --- |
| shape | `Step2DataSource.tsx` – mock を直接 import。UI はボックスで表示。 | `Step3License.tsx` – mock からライセンス情報取得。外部リンクを開いて承認。 | いずれも `@hierarchidb/_app-datasource` への置き換え TODO コメントあり。 |
| location | 未整備（SelectionStep に埋め込み）。 | License の概念はあるが UI が未統一。 | 4→6 ステップ化の際に欠落している。 |
| route | 旧 UI では `routeType` などで別用途。TanStack 移行後に同様の構造が要求される可能性大。 | 既存の Approval UI は限定的。 | Draft をドラフト基準へ直すタイミングで共通化が必要。 |

## コンポーネント案

### packages/ui/datasource

- `DataSourceSelector`
  - Props: `options`, `value`, `onChange`, `disabled`, `renderDescription?`。
  - Option の型は `{ id: string; name: string; description: string; icon?: ReactNode; licenseSummary?: string; metadata?: Record<string, unknown> }` を想定。
  - レイアウト: MUI Card/Box ベース、選択中は `action.selected` 背景。
  - i18n: label/description はプラグイン側から渡す。
  - Draft 更新: プラグイン側で `onChange({ dataSource: option.id, licenseAgreement: false, ... })` を呼ぶ。

- `useDataSourceOptions`
  - プラグイン固有の定義（Osm/GeoNames/Wikidata など）をマージし、Selector に渡す配列を生成するヘルパー。

### packages/ui/license

- `LicenseAgreementStep`
  - Props: `dataSource`（`DataSourceOption` と同型）、`agreementState`（{ agreed: boolean; agreedAt?: string }）、`onAgree`、`disabled`。
  - レイアウト: Alert/Stack を使い、承認前後の表示とボタンの色を統一する。
  - ライセンス本文は外部リンク／埋め込みテキストの両方に対応。
  - 承認ボタン押下で `onAgree({ agreed: true, agreedAt: new Date().toISOString() })` をコール。

## 実装ステップ

1. 既存の shape プラグイン Step2/Step3 をベースに、共通コンポーネントの skeleton を作成。
2. 新規パッケージ `packages/ui/datasource` / `packages/ui/license` を pnpm ワークスペースへ登録。`package.json`, `tsconfig`, `vitest.config` を準備。
3. Shape プラグインから Drift させ、`Step2DataSource` / `Step3License` を共通コンポーネント利用に書き換え。ユニットテストを整備。
4. Location プラグインで Step2/Step3 を新規導入（Basic Info → Data Source → License → Selection → Batch Parameters → Preview の形へ）。
5. Route プラグインのダイアログ整備時に同じコンポーネントを利用。Draft ドラフト構造と整合を取る。
6. ドキュメント更新（本ファイルへの追記、各プラグイン README、共通 ToDo のチェック）。

## テスト戦略

- `packages/ui/datasource` / `packages/ui/license` それぞれに Vitest + @testing-library/react を用いた基本的なスナップショット/interaction テストを用意。
- 各プラグインではステップを通した Draft 更新テストを追加（Step → Draft ドラフトへ反映 → 次ステップに繋がること）。
- Playwright でのダイアログ E2E（データソース選択→ライセンス承認→プレビュー）を Location/Shape の代表ケースで検証。

## 進捗メモ（2025-10-06）

- `packages/ui/datasource` / `packages/ui/license` を作成し、`DataSourceSelector` と `LicenseAgreementStep` の初版を作成。
- Location プラグインのダイアログを 6 ステップ構成へ再設計し、Step2/Step3 で共通コンポーネントを利用開始。Draft の `dataSource` / `licenseAgreement` / `licenseAgreedAt` 更新フローと新しい翻訳キーを整備。
- Shape プラグインの Step2 / Step3 を共通実装へ差し替え中（テストと翻訳整理は後続タスクで追う）。
- Route プラグイン適用および Vitest による共通コンポーネントの単体テストは未着手。今後のタスクに残す。
