# shape-plugin 新 vt パイプライン実装（shape-fetch / transform / vt）

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

PLANS.md はリポジトリ直下の `PLANS.md` を参照し、この ExecPlan はその要件に従って更新し続ける。

## Purpose / Big Picture

新しい shape-fetch / transform / vt パイプラインを shape-plugin に実装し、旧 vectortile 実装を完全に置き換える。ユーザーは Step2〜Step6 の UI を通じて shape のビルドを開始でき、Step5 の 3 列（fetch/transform/vt）進捗が動き、Step6 のプレビューが vt-store に保存されたタイルを参照して表示される。旧実装や旧ストアへの互換維持は不要で、既存データは破棄・再生成する。

## Progress

- [x] 2026-01-13 18:30 JST: ExecPlan の初版を作成した。
- [x] 2026-01-13 19:05 JST: vt-store / vt-shape-store / vt-orchestrator の新規パッケージ雛形を追加し、tsconfig.base のエイリアスを追加した。
- [x] 2026-01-13 19:30 JST: vt-shape-store の Dexie スキーマと Query/Mutation の雛形を実装した。
- [x] 2026-01-13 20:00 JST: vt-store の Dexie スキーマと VTQueryAPI / VTMutationAPI の雛形を実装した。
- [x] 2026-01-13 20:25 JST: vt-orchestrator の taskQueue（Dexie 永続化 + in-memory 通知）の雛形を実装した。
- [x] 2026-01-13 20:45 JST: vt-orchestrator の runStageTasks 雛形を実装し、waiting → running → completed/failed の遷移を提供した。
- [x] 2026-01-13 21:20 JST: transform/vt の基本ハンドラ（簡略化・tileIndex生成・band3予約・vt生成）を追加した。
- [ ] vt-orchestrator の taskQueue / transform / vt 実行ロジックを実装し、タスク状態遷移と band3 予約を含めた処理が動作するようにする（完了: taskQueue runner の雛形 + transform/vt ハンドラ雛形; 残り: 実処理の精密化と統合）。
- [ ] shape-plugin の shape-fetch 実装を追加し、transform/vt タスク生成と taskQueue 記録を行う。
- [ ] shape-plugin の worker 側 API と UI 側の接続を新パイプライン向けに差し替え、Step5/Step6 が新実装を使うことを確認する。
- [ ] 旧 vectortile 系のコードと不要になったストアを削除し、新実装のみが残るようにする。
- [ ] 最低限の手動検証（Step2〜Step6 の一連動作）と、必要なテストを実行して記録する。

## Surprises & Discoveries

- まだなし。

## Decision Log

- Decision: ステージ名は shape-fetch / transform / vt に統一し、旧 download/extract/vectortile を使用しない。
  Rationale: 新仕様の用語に統一し、旧実装との混同を避けるため。
  Date/Author: 2026-01-13, Codex
- Decision: taskQueue の状態は waiting/running/completed/failed を使い、reused/skipped は message 前置詞で表現する。
  Rationale: 既存 UI の前提を崩さずに再利用・スキップを表現するため。
  Date/Author: 2026-01-13, Codex
- Decision: band3 予約上限超過はエラーとして扱い、復旧策は提供しない。
  Rationale: メモリ破綻を避ける安全策であり、サポート対象外を明確にするため。
  Date/Author: 2026-01-13, Codex

## Outcomes & Retrospective

- 未着手。

## Context and Orientation

この実装は shape-plugin のバッチ処理を新しい vt パイプラインへ置き換える作業である。ここでの「パイプライン」は、外部データ取得（shape-fetch）、ズーム帯ごとの簡略化（transform）、ベクトルタイル生成（vt）という 3 つの段階を順に実行する処理を指す。ズーム帯（band）は z0-z2 を band0、z3-z5 を band1、z6-z8 を band2、z9-z11 を band3 とし、band3 は adminLevel>=2 が選択された国が存在する場合に自動的に有効化される。

既存の実装は `plugins/shape-plugin/src/services/batch` と `packages/features/vectortile-*` を中心に組まれており、旧ステージ名（download/extract/vectortile）を前提にしている。新実装では以下を新設し、それに合わせて shape-plugin を作り直す。

- `packages/vt-shape-store`: shape の中間ストアを担う Dexie DB。テーブルは `stage1Buffers`, `transformBandBuffers`, `tileIndexBand`, `vtBand3Reservations`。
- `packages/vt-store`: vt タイルの保存と参照 API（VTQueryAPI / VTMutationAPI）。
- `packages/vt-orchestrator`: transform/vt タスクの実行と taskQueue の永続化、進捗通知を担う。

taskQueue は Dexie で永続化されるタスク表であり、UI の Step5（LRUSplitPane）へ進捗通知を行う。status は waiting/running/completed/failed を使い、再利用やスキップを表す場合は message に `reused:` / `skipped:` の前置詞を付ける。fetch の実行は plugin 側が行い、taskQueue には記録のみを行う。

shape-fetch は国コードと自治体レベル単位で GeoJSON を取得し、flatgeobuf に変換して `stage1Buffers` に保存する。`sourceKey` は `${countryCode}:${adminLevel}` で、内部は ISO2 を採用する。外部 API が ISO3 を要求する場合は dataSource strategy 側で ISO2→ISO3 変換を行う。smartFetch のキーは URL を使い、GET 取得は URL をそのままキーとして扱う。

transform は band 別に簡略化した FGB を作成し、band 内最小 z だけ tileIndex を作成する。簡略化は turf の Ramer–Douglas–Peucker を使い、WebMercator(meters) の計算式で tolerance を決める。grid-snap は band 内の最詳細タイルの extent=4096 に合わせて行う。adminLevel の低いものから実行するため、transform タスクには `stagePriority` を付与し、orchestrator は優先度の高いタスクを先に処理する。

vt は geojson-vt でタイル生成し、境界ラインをデデュープして vt-pbf を生成し、VTMutationAPI に保存する。vt の保存キーは `tileId` と `bufferSetHash` を区切り文字で連結したものを使う。

参照すべき設計ドキュメントは以下。

- 共通仕様: `docs/vt-pipeline-design.md`
- shape 固有差分: `docs/vt-shape-pipeline-design.md`

## Plan of Work

まず新規パッケージ（vt-store / vt-shape-store / vt-orchestrator）を追加し、最小のビルド・型チェックが通る骨組みを作る。次に vt-shape-store と vt-store の Dexie スキーマおよび API を実装し、shape-fetch/transform/vt が読み書きできる永続化基盤を用意する。その後 vt-orchestrator を実装し、taskQueue の永続化、transform 処理（簡略化・tileIndex・band3 予約）、vt 処理（geojson-vt → vt-pbf → dedupe → 保存）を揃える。

並行して shape-plugin 側を新構成に移行する。shape-fetch は plugin が担当し、smartFetch を使って GeoJSON を取得し `stage1Buffers` に保存する。その上で transform/vt のタスクを生成して taskQueue に記録する。worker 側 API は vt-orchestrator を呼び出す形に再編し、UI からは現行の Step5/Step6 ルートを維持する。

最後に旧実装の `packages/features/vectortile-*` と `packages/features/shape-store` のうち新実装で不要になるものを削除し、shape-plugin からの参照を完全に取り除く。既存データは破棄する前提なので、移行コードや互換アダプタは作らない。

## Concrete Steps

このセクションは作業の進行に合わせて追記する。最初の手順は以下を実施する。

- 作業ディレクトリ: `/Users/hiroya/WebstormProjects/hierarchidb`
  - 既存の vectortile/shape-store の参照箇所を洗い出す。
    - 例: `rg -n "vectortile|shape-store" plugins/shape-plugin packages/features`
  - vt-store / vt-shape-store / vt-orchestrator の新規ディレクトリを作成し、`package.json` と `tsconfig.json` を追加する。
  - `pnpm -r lint` は重いため、初期は `pnpm --filter @hierarchidb/shape-plugin typecheck` で局所チェックを行う。

作業が進んだら、次のような実行例を追記する。

  pnpm --filter @hierarchidb/vt-store build
  pnpm --filter @hierarchidb/vt-shape-store build
  pnpm --filter @hierarchidb/vt-orchestrator build

## Validation and Acceptance

最低限の受け入れ観点は以下。

- shape ノードで Step2〜Step4 を設定し、Step5 の build を実行すると fetch/transform/vt の 3 列進捗が更新される。
- band3 が有効化される条件（adminLevel>=2 の選択）が満たされると band3 の vt タスクが追加される。
- vt タイルが vt-store に保存され、Step6 のプレビューで表示できる。

テストは段階的に実施する。まずは shape-plugin と新規パッケージの typecheck、必要に応じてユニットテストを追加・実行する。実行コマンドと結果は Progress と Artifacts に記録する。

## Idempotence and Recovery

この移行は後方互換を持たないため、旧実装を消した状態で再実行しても同じ結果になるようにする。中間ストアや vt-store のデータは破棄して再生成する前提なので、作業中に失敗した場合は該当テーブルを削除して再実行する。band3 予約上限の超過はエラーとして扱い、復旧策は提供しない。

## Artifacts and Notes

作業途中の短い差分やコマンド結果をここへ記録する。初期は空のままでよい。

## Interfaces and Dependencies

以下のインターフェースと依存関係を前提に実装する。新規に作成するファイルは明示する。

- `packages/vt-store/src/db/schema.ts`: vt タイル保存用の Dexie schema。
- `packages/vt-store/src/query/vtQuery.ts`: VTQueryAPI（tileId と bufferSetHash による取得）。
- `packages/vt-store/src/mutation/vtMutation.ts`: VTMutationAPI（vt-pbf の保存・削除）。
- `packages/vt-shape-store/src/db/schema.ts`: `stage1Buffers`, `transformBandBuffers`, `tileIndexBand`, `vtBand3Reservations`。
- `packages/vt-shape-store/src/mutation/*.ts`: stage1/transform/tileIndex/band3 の upsert API。
- `packages/vt-shape-store/src/query/*.ts`: stage1/transform/tileIndex の取得 API。
- `packages/vt-orchestrator/src/task/taskQueue.ts`: taskQueue の永続化（Dexie）と進捗イベントの通知。
- `packages/vt-orchestrator/src/transform/transformBand.ts`: turf RDP を使った band 別簡略化。
- `packages/vt-orchestrator/src/transform/tileIndexWriter.ts`: geojson-vt で tileIndexBand を作成。
- `packages/vt-orchestrator/src/transform/band3Reservation.ts`: band3 予約の永続化。
- `packages/vt-orchestrator/src/vt/vtWorker.ts`: geojson-vt → boundary dedupe → vt-pbf 保存。
- `plugins/shape-plugin/src/services/build/shapeBuildConfig.ts`: Step4 の入力から BuildConfig を作る。
- `plugins/shape-plugin/src/services/build/shapeBuildRunner.ts`: vt-orchestrator の `runPipeline` を呼び出す。
- `plugins/shape-plugin/src/services/batch` と `plugins/shape-plugin/src/worker`: 旧実装を削除し、新 API を用意する。

外部ライブラリ依存:

- turf の simplify（Ramer–Douglas–Peucker）を使用する。WebMercator(meters) で tolerance を計算し、grid-snap と併用する。
- geojson-vt / vt-pbf を使用する。extent=4096 を前提に line dedupe を行う。
- SHA3 のハッシュは `packages/features/chunk-store` に既存の実装を使用する。

## 変更履歴

- 2026-01-13: 初版を作成した。理由は、shape-plugin 新実装に先立ち ExecPlan が必須であるため。
