# location/route Step2 Data Sourceの共通化

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

PLANS.md はリポジトリ直下の `PLANS.md` を参照し、その要件に従って本書を更新する。

## Purpose / Big Picture

location-plugin の Step2 で使っている IDE-GSM ファイル選択 UI を共通化し、route-plugin の Step2 を同じ仕組みに置き換える。これにより、IDE-GSM のローカル/リモート取り込み、ファイル名表示、削除操作が両プラグインで同じ体験になる。ユーザーは Step2 で IDE-GSM を選択したとき、同一の UI でファイルを取り込み、そのまま次のステップへ進めることを確認できる。

## Progress

- [x] (2026-01-26 22:43 JST) 既存 Step2 の構造と依存関係を整理し、共通化対象を確定する。
- [x] (2026-01-26 22:47 JST) 共通 UI コンポーネントを `packages/ui/datasource` に追加し、exports と型チェックを整備する。
- [x] (2026-01-26 22:47 JST) location-plugin Step2 を共通 UI で書き換え、振る舞いが変わらないことを確認する。
- [x] (2026-01-26 22:47 JST) route-plugin Step2 を共通 UI で書き換え、IDE-GSM の取り込み/表示/削除が同じ流れで動くことを確認する。
- [x] (2026-01-26 22:47 JST) 翻訳キー差分を整理し、route-plugin の文言を補完する。
- [x] (2026-01-26 22:47 JST) `pnpm --filter @hierarchidb/location-plugin typecheck` と `pnpm --filter @hierarchidb/route-plugin typecheck` を実行し、成功ログを残す。

## Surprises & Discoveries

- Observation: `pnpm --filter @hierarchidb/ui-datasource build` 実行時に tsdown の define オプション警告が出る。
  Evidence: Warning: Invalid input options ... Invalid key: Expected never but received "define".

## Decision Log

- Decision: 共通化の実装先は `packages/ui/datasource` とし、IDE-GSM 取り込み UI を `IdeGsmImportPanel` (仮称) として追加する。
  Rationale: Data Source 選択 UI と同じレイヤーに置くことで、location/route 双方の Step2 が同一コンポーネントを直接利用できる。FileInputWithUrl を内包する UI なので、プラグイン側の差分を最小にできる。
  Date/Author: 2026-01-26 (Codex)
- Decision: route Step2 の Clear cache ボタンは維持し、Data Source 選択 UI のみ共通化する。
  Rationale: 明示的な削除要求がなく、既存挙動を維持する方針を優先した。
  Date/Author: 2026-01-26 (Codex)

## Outcomes & Retrospective

- location/route Step2 の IDE-GSM 取り込み UI を共通化し、route でもローカル/リモート取り込みが同一の見た目になった。ui-datasource の dist を更新したため、他パッケージから新しい export が参照可能になった。残課題は特にないが、tsdown の define 警告は別タスクで整理する必要がある。

## Context and Orientation

location の Step2 は `plugins/location-plugin/src/ui/components/steps/LocationDataSourceStep.tsx` にあり、IDE-GSM 選択時にインラインのファイル情報表示、Import Local/Remote のダイアログ、削除ボタンを表示する。route の Step2 は `plugins/route-plugin/src/ui/components/steps/RouteDataSourceStep.tsx` にあり、DataSourceSelectionStep の Details カード内で FileInputWithUrl を表示している。どちらも `@hierarchidb/ui-datasource` の `DataSourceSelectionStep` を使い、IDE-GSM の入力は `@hierarchidb/ui-file` の `FileInputWithUrl` に依存する。

共通化では、IDE-GSM のインライン表示とローカル/リモート取り込みダイアログ、削除操作、ファイル名表示のロジックを 1 つの UI コンポーネントへまとめる。location/route の各 Step2 は、DataSourceSelectionStep の `renderOption` に共通コンポーネントを挿入し、Details カードは非表示にする。

## Plan of Work

まず `packages/ui/datasource/src` に IDE-GSM のインライン UI コンポーネントを新設する。コンポーネントは `FileInputWithUrl` を使い、ローカル取り込みとリモート取り込み用の 2 つのモーダルを持つ。入力後に `onChange` を呼び、`fileName` と `sourceUrl` を親が保持できるようにする。ローカルファイルの場合は blob URL を生成して返し、同コンポーネント内で置換/削除時にのみ revoke する。アンマウント時には revoke しない。

次に location の Step2 をこの共通コンポーネントに差し替える。現在の `renderOption` の IDE-GSM 部分は共通コンポーネントに置換し、`selectedArrayByCountries` と `ideGsmSelectionHash` をリセットする処理は Step2 側で保持する。clear cache ボタンは既に撤去済みのため触らない。

その後 route の Step2 を共通コンポーネントに置換する。`DataSourceSelectionStep` の Details カードは無効化し、IDE-GSM 選択時は location と同じインライン UI を表示する。route の Step2 は `ideGsmSourceUrl` に blob URL を保持できるようになり、Build でローカルファイルが扱えるようになる。この挙動変更は受け入れ基準に記録する。

最後に route-plugin の翻訳キーに、location と同等の IDE-GSM 表示文言 (`noFiles`, `importLocal`, `importRemote`, `fileFallback`, `removeFile`) を追加する。必要なら英語/日本語の双方に追加し、既存キーは維持する。

## Concrete Steps

作業ディレクトリは `/Users/hiroya/WebstormProjects/hierarchidb` とする。

1) 共通コンポーネントを追加する。
   - `packages/ui/datasource/src/IdeGsmImportPanel.tsx` を新規作成する。
   - 依存は `@mui/material`, `@mui/icons-material`, `@hierarchidb/ui-file`。
   - Props には `fileName`, `sourceUrl`, `disabled`, `labels` (文言セット), `onChange`, `onClear`, `onResetAfterChange` を含める。
   - 期待される使用例 (擬似コード):
       const handleChange = (next) => onUpdate({ ideGsmFileName: next.fileName, ideGsmSourceUrl: next.sourceUrl, ... });

2) `packages/ui/datasource/src/index.ts` に export を追加する。

3) location Step2 を更新する。
   - `plugins/location-plugin/src/ui/components/steps/LocationDataSourceStep.tsx` の IDE-GSM inline UI を新コンポーネントへ差し替える。
   - `selectedArrayByCountries` と `ideGsmSelectionHash` のリセットは既存通り維持する。

4) route Step2 を更新する。
   - `plugins/route-plugin/src/ui/components/steps/RouteDataSourceStep.tsx` で Details カードを非表示にし、`renderOption` に共通コンポーネントを差し込む。
   - `ideGsmSourceUrl` にローカル blob URL を格納するようになる点を確認する。

5) 翻訳キーを追加する。
   - `plugins/route-plugin/src/ui/locales/en.json` と `plugins/route-plugin/src/ui/locales/ja.json` に IDE-GSM の新しいキーを追加する。

6) 型チェックを実行する。
   - `pnpm --filter @hierarchidb/location-plugin typecheck`
   - `pnpm --filter @hierarchidb/route-plugin typecheck`

## Validation and Acceptance

- location Step2 で IDE-GSM を選択すると、ボックス内に「No CSV files imported.」と Import Local/Remote の 2 ボタンが表示される。ローカルファイルを選択するとファイル名と File アイコンと削除ボタンが表示される。
- route Step2 でも同じ UI が表示され、ローカルファイル選択で file 名が表示される。
- route Build で IDE-GSM を選択している場合、ローカルファイルの blob URL が `ideGsmSourceUrl` に入り、Build が source URL 不足エラーで止まらない。
- `pnpm --filter @hierarchidb/location-plugin typecheck` と `pnpm --filter @hierarchidb/route-plugin typecheck` が exit 0 で終了する。

## Idempotence and Recovery

同じ差分を繰り返し適用しても挙動は変わらない。もし問題が出た場合は `git revert` で共通コンポーネント追加と Step2 差し替えのコミットを戻せば復旧できる。

## Artifacts and Notes

- 変更後の IDE-GSM 表示は両プラグインで同じ UI になる。
- 例: typecheck 成功ログは以下のようになる。
    > pnpm --filter @hierarchidb/route-plugin typecheck
    > tsc --noEmit

## Interfaces and Dependencies

新規コンポーネント `IdeGsmImportPanel` は以下の最小インターフェースを持つ。

- Props:
  - fileName?: string
  - sourceUrl?: string
  - disabled?: boolean
  - labels: { noFiles: string; importLocal: string; importRemote: string; fileFallback: string; removeFile: string; buttonLabel: string; instructions: string; }
  - onChange: (payload: { fileName: string; sourceUrl: string }) => void
  - onClear: () => void

このコンポーネントは内部で `FileInputWithUrl` を使い、local モーダルは `mode="local"`、remote モーダルは `mode="url"` を使う。blob URL はローカル選択時に生成し、次のローカル選択または clear 時のみ revoke する。

---

Plan revision note: 初版。location/route Step2 の共通化方針と実装位置を確定した。
Plan revision note: 実装完了に伴い Progress/Surprises/Decision/Outcomes を更新し、route の clear cache 維持を明記した。
