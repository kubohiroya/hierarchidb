# location/route 設計概要と現状差分

本ドキュメントは、location/route の設計概要を整理し、現行実装との差分を列挙し、必要な開発作業の計画を示す。

> **Status (2026-08-21): historical gap snapshot.**
> routeの正規仕様は`docs/route-build-flow-spec.md`、ステージ詳細は
> `docs/vt-route-pipeline-design.md`を参照する。本書のrouteに関する「確定事項」「現状」
> 「開発再開」の記述は作成時点の調査記録であり、正規仕様や現在の実装状態として扱わない。
> Worker→UI eventに関する節だけはIssue #1142/#1143/#1342の移行記録として維持する。

## 設計概要（要求仕様）

### location ノード

- データモデル: GroupEntity として GeoJSON Point の集合を扱う。
- 作成フロー:
  1. Step2: データソース選択。
  2. Step3: 国 × データ種別（セントロイド / 空港 / 港 / 駅 / インターチェンジ）の選択。
  3. Step4: ズームレベル範囲などの処理設定（入力仕様は `docs/vt-pipeline-design.md` を参照）。
  4. Step5: 選択データソースから以下をダウンロードし、メタデータとして保存。
     - 国名
     - 位置名
     - 位置タイプ
     - 緯度経度
     - 付帯データ（人口などの経済データ）
     加えて、ベクトルタイルを生成する。
  5. Step6: 地図とメタデータ一覧でプレビュー。

### route ノード

- データモデル: GroupEntity として GeoJSON LineString の集合を扱う。
- 作成フロー:
  1. Step2: データソース選択。
  2. Step3: 国 × データ種別（空路 / 海路 / 高速鉄道 / 在来線鉄道 / 高速道路 / 一般道路）の選択。
  3. Step4: ズームレベル範囲などの処理設定（入力仕様は `docs/vt-pipeline-design.md` を参照）。
  4. Step5: データソースからダウンロード後、メタデータとして保存。さらに以下を行う:
     - 対象 route ノードの兄弟ノード
     - 兄弟フォルダの子孫ノード
     - 先祖フォルダの兄弟ノード
     を候補に location ノードを探索し、Point 定義を集約して LineString の座標を生成。
     ベクトルタイルを生成する。
  5. Step6: 地図とメタデータ一覧でプレビュー。
  6. Step5 を再実施すると、location ノード探索と Point 定義の反映を再実行する。

## 設計検討時の決定メモ（履歴）

- `plugins/location-plugin/src/common/entities/LocationPoint.ts` はゼロベースで見直し、GroupEntity として扱う。
- route の LineString も GroupEntity として扱い、ツリーノードのライフサイクル（削除/複製/復元）に追随する。
- Point のメタデータは、地点名/座標など Point としての使用目的が明確な項目以外を `Record<string, string | number | null>` に保持する。
- Route のメタデータは、始点/終点 ID や交通手法など LineString の使用目的が明確な項目以外を `Record<string, string | number | null>` に保持する。
- route Step3 の国選択は「始点または終点に含まれる国」を対象とする、という案だった。
  現行仕様ではStep2 data-source coverageに存在する国×交通モードだけを有効化し、
  location DBの現在のPoint集合は表示条件にしない。source stageで始点/終点を解決できない場合は
  「処理対象なし」へ読み替えず、理由を持つtask errorとして扱う。
- location 探索順序は「兄弟ノード（アルファベット順）→兄弟フォルダの子孫（階層浅い順、同階層はアルファベット順）→先祖フォルダの兄弟ノード（階層深い順、同階層はアルファベット順）」とし、重複排除して合算する。
- route Step5 の再ビルドは差分生成方式とする。Step4 に「ダウンロードファイル削除」「キャッシュ中間データ削除」「メタデータ削除」ボタンを追加する（shape Step4 と同等の操作性）。
- Step6 のメタデータ一覧は shape 由来の共通 UI（仮想テーブル）へ寄せる。

## 旧実装スナップショット

以下は本書作成時のファイル構成と不足事項であり、2026-08-21のmainを表さない。

### location 実装の現状

- Step2 データソース選択: `plugins/location-plugin/src/ui/components/steps/LocationDataSourceStep.tsx`
- Step3 国×タイプ選択: `plugins/location-plugin/src/ui/components/steps/LocationSelectionStep.tsx`
- Step4 設定: `plugins/location-plugin/src/ui/components/steps/LocationBatchParametersStep.tsx`（入力仕様は `docs/vt-pipeline-design.md` を参照）
- Step5 ビルド UI: `plugins/location-plugin/src/ui/components/steps/LocationBuildStep.tsx`
- Step5 起動処理: `plugins/location-plugin/src/ui/components/steps-provider.tsx` の `startLocationBatch`
- Step6 プレビュー: `plugins/location-plugin/src/ui/components/steps/LocationMapPreviewStep.tsx`
- 実データ処理: `plugins/location-plugin/src/services/tiles/LocationVectorTileService.ts`
- データ保存: `plugins/location-plugin/src/services/pointRepository.ts`

現在のビルド処理は、既存の Point 一覧 (`listLocationPoints`) を参照してタイル化する。Step2/Step3 の選択結果はビルド時のデータ取得に連動していない。

### route 実装の現状

- Step2 データソース選択: `plugins/route-plugin/src/ui/components/steps/RouteDataSourceStep.tsx`
- Step3 設定: `plugins/route-plugin/src/ui/components/steps/RouteSelectionStep.tsx`
- Step4 設定: `plugins/route-plugin/src/ui/components/steps/RouteProcessingStep.tsx`（入力仕様は `docs/vt-pipeline-design.md` を参照）
- Step5 ビルド UI: `plugins/route-plugin/src/ui/components/steps/RouteBuildStep.tsx`
- Step5 起動処理: `plugins/route-plugin/src/ui/components/steps-provider.tsx` の `startRouteBatch`（未実装で通知のみ）
- Step6 プレビュー: `plugins/route-plugin/src/ui/components/steps/RoutePreviewStep.tsx`（メッセージのみ）
- バッチ基盤: `plugins/route-plugin/src/services/RouteBatchSessionOrchestrator.ts`, `RouteBatchManager.ts`, `RouteBatchSession.ts`

現在のビルド起動は未実装で、UI から route バッチは実行されない。プレビューも地図やメタデータ一覧ではなく、簡易メッセージのみ。

## 設計との差分（不足/齟齬）

### location の差分

- Step5 がデータソースからのダウンロード処理を実施していない。既存 DB の Point をタイル化するのみ。
- Step3 の国×タイプ選択が build 処理に反映されない。
- メタデータ保存の仕様（国名/位置名/タイプ/付帯データ）が未接続。
- Step6 のプレビューはタイルとポイント一覧の表示に留まり、メタデータ一覧（国・経済データ等）の一覧 UI が不足。
- `LocationPoint.ts` の構造が設計と一致していないため、GroupEntity 化を前提に再設計が必要。

### route の差分

- Step3 で国×種類を選択する設計に対し、現実装は transport/method と start/end の location 選択のみ。
- location ノード探索は「兄弟/兄弟フォルダ子孫」までは実装されるが、「先祖フォルダの兄弟ノード」の探索は未実装。
- Step5 のビルドが未実装で、ダウンロード/メタデータ保存/LineString生成/タイル生成が行われない。
- Step6 のプレビューは地図とメタデータ一覧ではなく、メッセージのみ。
- Step4 にキャッシュ/メタデータ削除の操作が無い。

## shape 由来の共通化で置換すべき機能

location/route の独自実装のうち、shape と共通化して置換すべき領域を列挙する。

- Download 取得/キャッシュ/認証通知:
  - `plugins/location-plugin/src/services/download/registry.ts`
  - `plugins/route-plugin/src/services/download/registry.ts`
  - `plugins/location-plugin/src/services/utils/authFetch.ts`
  - shape 側の共通化計画（Stage2）へ置換。
- Runtime Worker アダプタ登録:
  - `plugins/location-plugin/src/services/batch/adapters/registerRuntimeWorker.ts`
  - `plugins/route-plugin/src/services/batch/adapters/registerRuntimeWorker.ts`
  - shape 由来の共通化計画（Stage1）へ置換。
- Batch progress hook:
  - `plugins/location-plugin/src/common/hooks/useLocationProgress.ts`
  - `plugins/route-plugin/src/ui/hooks/useRouteBatchProgress.ts`
  - shape 由来の共通化計画（Stage4）へ置換。
- Worker→UI build-session event:
  - route/location の build session は `CanonicalBuildSessionEventSource` として、明示的な stage timing、authoritative task snapshot、task 単位の version 付き progress を提供する。
  - manager/orchestrator は `CanonicalBuildSessionManager` の `registerSession` 経由で `sessionStatusUpdated / stageSnapshotUpdated / taskProgressUpdated / heartbeat` を配信する。
  - aggregate な旧 `BuildProgressEvent` から canonical task event を推測・変換しない。旧 API surface 自体の削除は Issue #1142 で行う。
- Tabular API 作成/メタデータ管理:
  - `plugins/location-plugin/src/common/tabular/createLocationTabularApi.ts`
  - `plugins/route-plugin/src/common/tabular/createRouteTabularApi.ts`
  - shape 由来の共通化計画（Stage3）へ置換。

## 必要な開発作業の計画（段階）

### フェーズ 1: location の差分解消

- Step2/Step3 の選択結果をビルド処理へ反映する導線を追加。
- データソースから Point/メタデータを取得する実装をバッチ処理に統合。
- メタデータの保存と Step6 での一覧表示を追加。
- 既存 `LocationVectorTileService` をデータ取得後のタイル生成に接続。
- `LocationPoint.ts` を GroupEntity 前提で再設計し、Point/メタデータの切り分けを実装する。

### フェーズ 2: route の差分解消

- Step3 の国×種類選択を追加し、transport/method 選択に加えて国制約を扱う。
- location ノード探索に「先祖フォルダの兄弟ノード」を追加。
- Step5 のバッチ起動を実装し、
  - データソースからのダウンロード
  - location Point の集約
  - LineString の生成
  - メタデータ保存
  - タイル生成
  を行う。
- Step6 の地図 + メタデータ一覧プレビューを追加。
- Step4 に shape 同等の削除操作ボタンを追加し、差分生成の再ビルド導線を実装する。

### フェーズ 3: 共通化の段階導入

- Stage1/2/3/4 の共通化計画を location/route に適用し、shape と同等の基盤へ統合。

## 影響範囲と検証方針

- 影響範囲: UI Step2〜Step6、バッチ起動導線、データ保存（GroupEntity/metadata DB）、プレビュー UI。
- 検証: 影響範囲の typecheck、必要に応じてユニットテスト追加。UI の手動確認は別途記録。

## ロールバック

- 影響ファイルの差分 revert により復旧可能。
- データ構造変更がある場合は、フラグ OFF で従来経路に戻せる設計とする。

## 開発再開のための要点

- 本節は履歴上の再開メモであり、仕様の単一ソースではない。
- route作業は`docs/route-build-flow-spec.md`と親Issue #1356の着手順に従う。
- location は Point GroupEntity の再設計と、Step2/Step3 選択の build 反映が最優先である。
- route は LineString GroupEntity の導入、location 探索順序、Step5 差分生成と Step4 削除操作が最優先である。
- 共通化は Stage1〜4 を段階導入し、shape の挙動維持を最優先とする。
- pause/resume 導線の現状: shape は UI→Worker が接続済み、route も UI→Worker が接続済み、location は UI から Worker への呼び出しが未接続（UI はローカル state の切替のみ）。
