# 陸路（鉄道/高速鉄道/道路）向けの waypoints 生成と OSM ルーティング統合

この ExecPlan は生きた文書です。`Progress`、`Surprises & Discoveries`、`Decision Log`、`Outcomes & Retrospective` を常に更新してください。

本 ExecPlan はリポジトリ直下の `PLANS.md` に従って作成します。変更や実装の途中で判断が変わった場合は、この文書を更新し、最後に理由を追記してください。

## Purpose / Big Picture

陸路（鉄道/高速鉄道/道路）のルートに対して、指定した交通モードを優先した経路を OpenStreetMap 由来のルーティング API から取得し、距離・所要時間・waypoints（経路の座標列）を生成できるようにする。利用者は「陸路ルートを作成した際に、直線ではなく道路/鉄道に沿った経路のライン」が得られ、ベクトルタイルに反映されることを確認できる。

本計画は「何を実装すべきか」を作業項目として列挙し、それを実行可能な手順として文書化する。実装後は、ルート生成処理が OSRM のような OSM ベースのルーティング API へアクセスし、必要に応じて認証・スロットリング・リトライを `@hierarchidb/download` を通じて行う。

## Progress

- [x] 2025-12-29 12:03 JST: ExecPlan の初稿を作成。
- [ ] 作業項目のうち、route-engine への OSRM エンジン移設方針を確定する。
- [ ] runtime-worker と route-plugin のエンジン注入パスを統一する。
- [ ] 陸路向けのルーティング API 呼び出しと waypoints 永続化を実装する。
- [ ] 検証と運用ログ更新を完了する。

## Surprises & Discoveries

- Observation: 既に route-plugin 側に OSRM クライアントと独自のスロットリング実装が存在する。
  Evidence: `plugins/route-plugin/src/services/engines/OsrmEngine.ts`, `plugins/route-plugin/src/services/net/ThrottledPort.ts`.

## Decision Log

- Decision: OpenStreetMap ルーティング API は OSRM 互換の `/route/v1/{profile}` エンドポイントを利用する前提で設計する。
  Rationale: 既存の OSRM クライアント実装があり、必要な距離/所要時間/座標列を最小工数で取得できるため。
  Date/Author: 2025-12-29 / Codex

## Outcomes & Retrospective

- 未記入（実装後に記載）。

## Context and Orientation

このリポジトリには route-plugin と runtime-worker があり、ルートのバッチ生成や IDE‑GSM 取り込みを担当している。重要な用語は以下のとおり。

waypoints: ルートを構成する座標列。`[lon, lat]` の配列で、LineString の座標として利用される。

RouteLineString: ルートのラインデータ。`packages/features/route-store/src/index.ts` の `RouteLineString` に定義され、`waypoints` と `distance` などのメタデータを持つ。

RouteGenerator: ルート生成アルゴリズムを切り替えるユーティリティ。`packages/features/route-engine/src/RouteGenerator.ts`。`method` に `direct`, `great_circle`, `osm_route`, `searoute` を指定できる。

OSRM: OpenStreetMap データを使ったルーティングサービス。ここでは OSRM 互換の HTTP API を指し、`/route/v1/{profile}/{lon,lat;...}` を呼び出す。

Download Service: `@hierarchidb/download` で提供されるネットワーク層。`FetchNetworkPort` がリトライとスロットリングを含む GET を提供する。

現状の実装ポイント:

- IDE‑GSM の waypoint 生成は `packages/runtime-worker/src/services/RouteMutationService.ts` にある。ここで `RouteGenerator.generate` が呼ばれ、空路/海路の分岐が行われる。
- バッチ生成は `plugins/route-plugin/src/services/RouteBatchSession.ts` と `RouteBatchManager.ts` が行う。`RouteGenerator` にエンジンを注入しなければ `osm_route`/`searoute` はフォールバックする。
- OSRM クライアントは `plugins/route-plugin/src/services/engines/OsrmEngine.ts` に存在するが、`@hierarchidb/download` を直接使っていない。

## Plan of Work

作業項目は次の順で進める。まず OSRM のネットワーク呼び出しを `@hierarchidb/download` 経由に統一し、OSRM クライアントを route-engine へ移設または共有化する。次に runtime-worker と route-plugin の RouteGenerator に OSRM エンジンを注入し、陸路の交通モードに応じて `osm_route` を選択する。最後に waypoints・距離・所要時間の永続化とベクトルタイル生成への接続を確認し、テストと手動確認の手順を整える。

具体的な作業項目の列挙は以下のとおり。

1. `plugins/route-plugin/src/services/engines/OsrmEngine.ts` を route-engine へ移動するか、`packages/features/route-engine/src/OsrmEngine.ts` に移植して共通化する。
2. `@hierarchidb/download` の `FetchNetworkPort` を使った `NetworkPortLike` 実装を用意し、OSRM の GET が認証/スロットリング/リトライを通るようにする。
3. runtime-worker の `RouteMutationService` と route-plugin の `RouteBatchSession` に OSRM エンジンを注入し、陸路モードの `RouteGenerationConfig.method` を `osm_route` に設定する。
4. 交通モードと OSRM プロファイルの対応表を決め、`RouteGenerationOptions` に `osmProfile` と `osrmBaseUrl` を渡す。
5. 生成した waypoints・distance・duration を `RouteLineString` またはルートエンティティに保存し、ベクトルタイル生成へ確実に渡す。
6. 検証用のテスト、もしくは手動実行の検証手順を追加する。

## Concrete Steps

以下は、実装する際の具体的なコマンド手順の例である。作業ディレクトリは `/Users/hiroya/WebstormProjects/hierarchidb` を前提とする。

1) 依存と既存実装の確認

  - rg -n "OsrmEngine|osm_route|RouteGenerator" plugins/route-plugin packages/features/route-engine packages/runtime-worker

2) OSRM エンジンの共通化

  - `packages/features/route-engine/src/OsrmEngine.ts` を追加し、`plugins/route-plugin/src/services/engines/OsrmEngine.ts` のロジックを移植する。
  - `packages/features/route-engine/src/index.ts` からエクスポートする。

3) Download 経由の NetworkPort

  - `packages/runtime-worker/src/services/downloadAdapter.ts` を参照し、`FetchNetworkPort` から `NetworkPortLike` を満たすアダプタを追加する。
  - `FetchNetworkPort` の `rps`, `perHostConcurrency`, `retries` を `RouteBatchConfig` または `RouteGenerationOptions` から受け取れるようにする。

4) runtime-worker への注入

  - `packages/runtime-worker/src/services/RouteMutationService.ts` の `getIdeGsmRouteGenerator` で OSRM エンジンを注入する。陸路モードの場合は `osm_route` を選択し、`osmProfile` を付与する。

5) route-plugin への注入

  - `plugins/route-plugin/src/services/RouteBatchSession.ts` で `RouteGenerator` を `new RouteGenerator({ osrm: <download port>, searoute: ... })` へ置換する。
  - `RouteBatchManager` のタスク生成時に `methodOptions` に `osmProfile` と `osrmBaseUrl` を設定する。

6) 永続化とタイル生成の確認

  - `RouteLineString` 保存用の DB テーブル (`route-store`) へ waypoints・distance・duration を書き込む。
  - ベクトルタイル生成は `RouteBatchSession.generateVectorTiles` で LineString を使うことを確認する。

## Validation and Acceptance

受け入れ確認は以下のように行う。

- `pnpm --filter @hierarchidb/route-plugin typecheck` を実行し、既存の baseline 以外の新規エラーが出ないこと。
- IDE‑GSM 取り込みで陸路モードの lineStrings に waypoints が入り、`RouteQueryService` で `routeDistanceMeters` が `distance` または `waypoints` から計算できること。
- ルート生成を実行した後、ベクトルタイルが生成され、Map 側で線が表示されること。

例: OSRM エンドポイントが利用可能な環境で、`RouteBatchLaunchForm` から道路ルートを起動すると `osm_route` の LineString が生成される。

## Idempotence and Recovery

本計画は追加・差し替え中心であり、複数回の実行に耐える。作業途中で失敗した場合は、変更を revert し、`RouteGenerator` の注入箇所を元に戻せば元の挙動に戻る。`@hierarchidb/download` の設定を追加した場合は、設定を削除すれば従来の fetch に戻る。

## Artifacts and Notes

- 既存の OSRM エンジン: `plugins/route-plugin/src/services/engines/OsrmEngine.ts`
- ダウンロードのネットワークポート: `packages/features/download/src/adapters/FetchNetworkPort.ts`
- 既存のルート生成: `packages/features/route-engine/src/RouteGenerator.ts`

## Interfaces and Dependencies

- `@hierarchidb/route-engine`: `RouteGenerator`, `SearouteEngine`, 追加する `OsrmEngine`。
- `@hierarchidb/download`: `FetchNetworkPort` を使い、`rps`, `perHostConcurrency`, `retries` を設定可能にする。
- `RouteGenerationConfig` と `RouteGenerationOptions`: `osmProfile` と `osrmBaseUrl` を経路生成に渡す。
- `RouteLineString`: `waypoints`, `distance`, `speed` を保持し、ベクトルタイル生成で LineString を構成する。

