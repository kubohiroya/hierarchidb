# shape 3段階VTパイプライン再編（fetch / transform / vt）

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

PLANS.md はリポジトリ直下の `PLANS.md` を参照し、この ExecPlan はその要件に従って更新し続ける。

## Purpose / Big Picture

shape のビルドを fetch → transform → vt の3段階に再編し、transform-by-zoom を撤去する。ユーザーは Step4 でズーム帯の境界（`transformConfig.zoomBandBoundaries`）と vt 段の topojson+簡略化の有無（`vtConfig.enableTopojsonSimplify`）を設定でき、Step5 は3ステージの進捗で動き、vt 段が tile の PBF を生成する。処理はズーム帯の代表ズーム（帯内の最小ズーム）を基準に計算量を抑え、vt 段は必要に応じて topojson+簡略化を省略して品質と性能のトレードオフを制御できる。

## Progress

- [x] 2026-01-16 16:15 JST: ExecPlan の初版を作成した。
- [x] 2026-01-16 16:25 JST: 3段階再編のための設計差分を確定し、決定事項を Decision Log に反映した。
- [x] 2026-01-16 16:35 JST: 3段階再編の実装計画を Milestone ごとに更新し、Progress に反映した。
- [ ] Milestone 1: 設定/型/Step4 UI の更新（zoomBandBoundaries と enableTopojsonSimplify を必須化し、transform-by-zoom 設定を撤去する）。
- [ ] Milestone 2: pipeline と taskQueue の3段階化（transform-by-zoom 削除とステージ名統一）。
- [ ] Milestone 3: transform/vt の責務整理とデフォルト値見直し（代表ズーム処理の明確化と vt の optional topojson）。
- [ ] Milestone 4: 不要コード削除と検証（UI/ストア/テストの整理と手動検証）。

## Surprises & Discoveries

- まだなし。

## Decision Log

- Decision: ステージは fetch / transform / vt の3段階に統一し、transform-by-zoom を廃止する。
  Rationale: 代表ズームでの事前簡略化を前提に、vt 段の処理を軽量化する設計に戻すため。
  Date/Author: 2026-01-16, Codex
- Decision: ズーム帯の幅は固定3ではなく可変とし、設定値で決める。
  Rationale: 品質と計算量のトレードオフをユーザーが制御できるようにするため。
  Date/Author: 2026-01-16, Codex
- Decision: vt 段の topojson+簡略化は設定で省略可能とする。
  Rationale: vt 段の軽い簡略化ではなく、事前の transform で品質を担保する設計と両立させるため。
  Date/Author: 2026-01-16, Codex
- Decision: ズーム帯の境界は `transformConfig.zoomBandBoundaries` とし、境界となるズーム率の配列で表す。
  Rationale: UI の可変範囲入力と一致し、帯の定義を明確にできるため。
  Date/Author: 2026-01-16, Codex
- Decision: vt 段の topojson+簡略化の設定名は `vtConfig.enableTopojsonSimplify` とする。
  Rationale: topojson 化と簡略化を一体の任意処理として示し、挙動が明確になるため。
  Date/Author: 2026-01-16, Codex
- Decision: taskQueue のステージ名は `fetch` / `transform` / `vt` に統一する。
  Rationale: UI の3段階表示と一致させ、旧 `transform-by-zoom` を排除するため。
  Date/Author: 2026-01-16, Codex

## Outcomes & Retrospective

- 未着手。

## Context and Orientation

現状の shape ビルドは fetch / transform / transform-by-zoom / vt の4段階で、`plugins/shape-plugin/src/services/vt/shapePipeline.ts` が taskQueue を組み立てている。transform の実処理は `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts` と `packages/vt-orchestrator/src/transform/createTransformByZoomHandler.ts` が担当し、vt の処理は `packages/vt-orchestrator/src/vt/vtStage.ts` が担う。ビルド設定は `packages//src/config.ts` の `FetchConfig` / `TransformConfig` / `TransformByZoomConfig` / `VTConfig` に定義され、Step4 の UI は `plugins/shape-plugin/src/ui/components/step4` が入力値を編集する。Step5 の進捗は taskQueue のステージ名に依存し、`packages/components/src/BuildStepStagePanel.tsx` と `plugins/shape-plugin/src/ui/components/step5` が表示を行う。

ここでいう「ズーム帯」は複数のズーム率を束ねたまとまりで、帯内の最も粗いズーム率を「代表ズーム」と定義する。代表ズームは transform 段での量子化・簡略化の基準になり、vt 段は代表ズームのデータからタイルごとの地物を生成する。「topojson+簡略化」は vt 段でのタイル内処理で、設定により省略できる。

## Plan of Work

最初に、3段階に再編するための設定と UI を整理する。`TransformByZoomConfig` と transform-by-zoom ステージの参照を撤去し、`TransformConfig` にズーム帯の境界を表す必須プロパティ `zoomBandBoundaries` を追加する。vt 段の topojson+簡略化の ON/OFF を表す `vtConfig.enableTopojsonSimplify` を追加し、Step4 の UI で設定できるようにする。この作業は既存の型必須化タスクと衝突しやすいので、関連タスクの完了を前提に着手し、必須化ポリシーに従ってすべての新規プロパティも必須で定義する。

次に、shape の pipeline と vt-orchestrator を3段階に組み替える。`shapePipeline.ts` から transform-by-zoom タスク作成・実行・削除処理を削除し、transform の出力を vt 段で直接参照するようにする。vt-orchestrator 側では `createTransformByZoomHandler.ts` と関連する types を削除または使用箇所から外し、transform の結果に tile index を併設する現在の仕様を保ちつつ、vt 段が参照するストアの形を明示する。taskQueue のステージ名は `fetch` / `transform` / `vt` に統一し、UI に表示されるステージ名と整合させる。

続いて、transform 段の処理内容を明文化し、ズーム帯の代表ズームに対して量子化・重複頂点除去・面積ゼロ等の無効ポリゴン除去を行う。これらの処理は transform 段で完結させ、vt 段はタイル収集と optional な topojson+簡略化に限定する。無効ポリゴン検知のエラー情報は既存の詳細ログ出力を維持し、設定のデフォルト値は invalid polygon が多発しない値へ見直す。見直しの根拠は、現行ログにある minRingVertices / minRingArea 等の統計情報と照合して説明する。

最後に、不要になった transform-by-zoom の UI・設定・ストア・テストを削除し、Step5 の進捗表示が3段階になることを確認する。既存のキャッシュは互換維持を行わず破棄する前提とし、ロールバックは git の revert と Dexie の該当ストア削除で対応する。

実施項目は4つに分割する。第一に設定と UI の整理を行い、プロパティ追加と削除を完了させる。第二に pipeline と taskQueue のステージ名を3段階へ変更し、transform-by-zoom を排除する。第三に transform と vt の処理責務を再定義し、代表ズームの前処理と vt 段の optional topojson を実装する。第四に不要コードの削除と検証を行い、Step5 の進捗と vt 出力を確認する。これらは順序依存で、第一の完了が第二と第三の前提、第四は全体完了後に実施する。

## Milestones

Milestone 1 は設定と UI の更新に集中する。`packages//src/config.ts` で `transformConfig.zoomBandBoundaries` と `vtConfig.enableTopojsonSimplify` を必須プロパティとして追加し、`TransformByZoomConfig` を削除する。Step4 の UI（`plugins/shape-plugin/src/ui/components/step4`）で新プロパティを編集できるようにし、既存の transform-by-zoom 設定入力を撤去する。完了時点で型チェックが通り、Step4 の画面にズーム帯の境界設定と topojson+簡略化の設定が表示されることを確認する。検証は `pnpm --filter @hierarchidb/gis-sdk build` と `pnpm typecheck` を実行する。\n\nMilestone 2 は pipeline と taskQueue の3段階化を行う。`plugins/shape-plugin/src/services/vt/shapePipeline.ts` から transform-by-zoom のタスク生成・実行・削除処理を削除し、`fetch`/`transform`/`vt` の3ステージだけを組み立てる。`packages/vt-orchestrator` の taskQueue 型とステージ定義を3段階に合わせて更新する。完了時点で Step5 の進捗が3列になり、旧 transform-by-zoom が表示されないことを確認する。検証は UI 手動操作で行い、ログに taskQueue の stage 名が `fetch` / `transform` / `vt` のみであることを確認する。\n\nMilestone 3 は transform と vt の責務整理に集中する。transform 段は代表ズームでの量子化・重複頂点除去・無効ポリゴン除去を担い、vt 段はタイル収集と `vtConfig.enableTopojsonSimplify` による topojson+簡略化を任意で実施するようにする。デフォルト値は invalid polygon が多発しない値に見直し、見直し理由を ExecPlan の Artifacts に残す。完了時点で transform 段の失敗時に即 failed となり、vt 段は設定に応じて topojson+簡略化を行う。検証は Step5 の実行ログと、既存のエラーデータ（minRingVertices / minRingArea 等）に基づく確認を行う。\n\nMilestone 4 は不要コード削除と検証を行う。transform-by-zoom に関連する UI・設定・ストア・テスト・型の残骸を削除し、Step5 で3段階表示のみが残ることを確認する。Dexie の transform-by-zoom テーブルは互換性維持を行わないため削除対象とし、再実行時のデータ削除手順を明記する。完了時点で `pnpm typecheck` が通り、手動で Step2〜Step6 を実行して vt タイル生成とプレビューが確認できることを受け入れ基準とする。

## Concrete Steps

作業ディレクトリは `/Users/hiroya/WebstormProjects/hierarchidb` とする。最初に transform-by-zoom の参照を洗い出し、影響範囲を確定する。

  rg -n "transform-by-zoom|TransformByZoom" plugins/shape-plugin packages/vt-orchestrator packages

設定の追加と削除を行う場合は `packages//src/config.ts` と Step4 の UI を更新し、必須化ポリシーに従ってプロパティを必須化したうえで型エラーがないことを確認する。依存パッケージの型出力が必要な場合は `pnpm --filter <pkg> build` を先に実行する。

  pnpm --filter @hierarchidb/gis-sdk build
  pnpm typecheck

pipeline の再編後は Step5 の表示と taskQueue のステージ名が3段階になっていることを UI で確認する。実際のビルドは Step2〜Step5 の操作で行い、transform 段でタスクが失敗した場合は直ちに failed になること、vt 段が設定によって topojson+簡略化を行わないケースでも完了することを確認する。

## Validation and Acceptance

受け入れは「ユーザーが3段階のビルドを完走できること」を中心に判定する。Step4 でズーム帯の幅と topojson+簡略化の有無を設定し、Step5 の build を開始したときに fetch/transform/vt の3列だけが表示されることを確認する。transform 段が代表ズームの出力を作成し、vt 段が tile の PBF を生成して Step6 のプレビューに反映されることを確認する。型検証は `pnpm typecheck` を成功させ、関連パッケージの build が必要な場合は `pnpm --filter @hierarchidb/gis-sdk build` などを先に実行してから再実行する。

## Idempotence and Recovery

設定変更とパイプライン再編は繰り返し適用できるようにし、同一設定で再実行した場合に同じ出力が得られることを目指す。キャッシュ互換は維持しないため、再試行時は Dexie の該当ストアを削除して再実行する。ロールバックは git の revert でコードを戻し、UI 表示と taskQueue のステージ名が旧4段階に戻ることを確認する。

## Artifacts and Notes

作業中に得られたログや差分、検証結果を短く記録する。初期は空のままでよい。

## Interfaces and Dependencies

この再編で触れる主要なインターフェースは次の通りである。`packages//src/config.ts` は build 設定の単一ソースであり、transform-by-zoom を撤去したうえで、`transformConfig.zoomBandBoundaries` と `vtConfig.enableTopojsonSimplify` を必須プロパティとして追加する。`plugins/shape-plugin/src/ui/components/step4` はこれらの設定を編集する UI を提供し、`plugins/shape-plugin/src/services/vt/shapePipeline.ts` は taskQueue を `fetch`/`transform`/`vt` の3段階で組み立てる。`packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts` は代表ズームの量子化・簡略化・無効ポリゴン除去の責務を持ち、`packages/vt-orchestrator/src/vt/vtStage.ts` はタイル収集と optional な topojson+簡略化を行う。transform-by-zoom 関連の handler と types は撤去または使用箇所から切り離し、taskQueue の types は3段階に合わせて更新する。

外部依存は既存の geojson-vt / vt-pbf を継続利用し、turf simplify などの簡略化処理は transform 段に集約する。vt 段で topojson+簡略化を行う場合は既存の処理を再利用し、設定によりスキップできるようにする。

## 変更履歴

- 2026-01-16: 初版を作成した。理由は、3段階再編の作業開始に先立ち ExecPlan が必要なため。
- 2026-01-16: 設計方針レビューとしてプロパティ名とステージ表記を明記し、Decision Log と Progress を更新した。
