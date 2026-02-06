```md
# AppによるPlugin DB初期化責務の移管（store化）

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan must be maintained in accordance with `PLANS.md` in the repository root.

## Purpose / Big Picture

アプリ起動時のプラグインDB初期化・prewarm/clearを、pluginの`/database`モジュールではなく`*-store`パッケージに集約し、app側で一元的に実行できるようにする。これによりプラグインはDB実装の公開を持たず、DBの運用責務はappとstoreに集約される。

## Progress

- [x] (2026-01-30 10:42 JST) 既存のprewarm/clear経路、plugin database module、registry生成の依存関係を把握。
- [x] (2026-01-30 10:55 JST) ExecPlan作成と合意内容の反映（このファイルの継続更新）。
- [x] (2026-01-30 11:20 JST) resolver-store新設と各storeへのprewarm/clear実装追加。
- [x] (2026-01-30 11:28 JST) plugin側databaseモジュール撤去、manifestのdbName/schema/version記述、app側prewarm/clearをstoreベースへ切替。
- [x] (2026-01-30 11:36 JST) plugin-registry再生成とtypecheck、運用ログ更新。

## Surprises & Discoveries

- Observation: `plugin-registry` の database-loaders は、database module export がある時のみ生成される。
  Evidence: `packages/tools/build-scripts/src/plugin-registry/registry-generator.ts`
- Observation: app側のprewarm/clearは `pluginDatabaseLoaders` を直接参照している。
  Evidence: `app/src/plugin-runtime/databases.ts`, `app/src/plugin-runtime/clearIndexedDb.ts`
- Observation: database export削除後も dist に古いdatabase entryが残り、registry generatorが警告を出す。
  Evidence: `pnpm tools:gen-plugin-registry` 実行時の Entry path validation warnings

## Decision Log

- Decision: storeパッケージからprewarm/clearを提供し、appはstoreモジュールを直接importして実行する。
  Rationale: pluginのdatabaseモジュール撤去要件を満たしつつ、責務をapp/storeに集約できるため。
  Date/Author: 2026-01-30 / Codex
- Decision: resolver-storeを新設し、resolver DB定義を移設する。
  Rationale: resolver用のstoreが存在しないため。
  Date/Author: 2026-01-30 / Codex

## Outcomes & Retrospective

- appがstore経由でDB prewarm/clearを実行し、pluginのdatabaseモジュール依存を撤去した。
- resolver-storeを新設し、location/route/shape/storeへclear APIを追加した。

## Context and Orientation

- appのDB prewarm/clear:
  - `app/src/plugin-runtime/databases.ts`（prewarm）
  - `app/src/plugin-runtime/clearIndexedDb.ts`（clear）
- plugin manifest/registry:
  - `plugins/*-plugin/src/plugin-manifest.ts`
  - `packages/plugin-registry/src/types.ts`
  - `packages/plugin-registry/src/derivations.ts`
  - `packages/tools/build-scripts/src/plugin-registry/*`
- 現行のplugin database module:
  - `plugins/location-plugin/src/database/index.ts`
  - `plugins/route-plugin/src/services/database/index.ts`
  - `plugins/resolver-plugin/src/worker/database/index.ts`
- storeパッケージ:
  - `packages/`
  - `packages/`
  - `packages/`
  - （新規）`packages/`

## Plan of Work

1) resolver-storeを追加し、Dexie DB定義とclear/prewarm APIを実装する。
2) location/route/shape storeにclear/prewarm APIを追加する（Dexie deleteとopen/close）。
3) pluginのdatabaseモジュールを撤去し、package.jsonのexports/build対象から削除する。
4) plugin manifestに`database: { dbName, schema, version }`を記述し、prewarm記述はstore側へ移す。
5) appのprewarm/clear実装を、storeモジュールを直接importする方式へ変更する。
6) plugin-registry生成を再実行し、typecheckを通す。

## Concrete Steps

1. resolver-store新設
   - `packages//package.json`
   - `packages//tsconfig.json`
   - `packages//src/index.ts`
   - `packages//src/ResolverDB.ts`

2. store API追加
   - `packages//src/LocationDB.ts` に `clearLocationDatabases` 等を追加
   - `packages//src/RouteDB.ts` に `getRouteDB` / `clearRouteDatabases` を追加
   - `packages//src/index.ts` へ `clearShapeDatabases` / `prewarmShapeDB` 追加

3. plugin database module撤去
   - `plugins/location-plugin/src/database/**` 削除、package.json exports/build更新
   - `plugins/route-plugin/src/services/database/**` 削除、package.json exports/build更新
   - `plugins/resolver-plugin/src/worker/database/**` 削除、package.json exports/build更新
   - `plugins/shape-plugin/src/index.ts` の prewarm onRegister 削除（必要に応じて）

4. manifest更新
   - `plugins/location-plugin/src/plugin-manifest.ts`
   - `plugins/route-plugin/src/plugin-manifest.ts`
   - `plugins/resolver-plugin/src/plugin-manifest.ts`
   - `plugins/shape-plugin/src/plugin-manifest.ts`

5. app側 prewarm/clear 切替
   - `app/src/plugin-runtime/databases.ts`
   - `app/src/plugin-runtime/clearIndexedDb.ts`
   - `app/src/plugin-runtime/store-selection.ts` または新規 store loader 定義

6. 生成と検証
   - `pnpm tools:gen-plugin-registry`
   - `pnpm --filter @hierarchidb/app typecheck`

## Validation and Acceptance

- 起動時のprewarmがstoreモジュール経由で実行される（ログ/コード上の呼び出しを確認）。
- clearIndexedDbがstoreのclear関数を呼び、plugin database moduleに依存しない。
- `pnpm --filter @hierarchidb/app typecheck` が exit 0。

## Idempotence and Recovery

- prewarm/clearは再実行可能であること。
- 問題があれば該当差分をrevertし、旧plugin database moduleのexportsとprewarmを復元する。

## Artifacts and Notes

（実装中に追加）

## Interfaces and Dependencies

- `app` は `@hierarchidb/*-store` を直接importしてprewarm/clearを行う。
- pluginは`/database`エクスポートを持たない。
- plugin manifestは`database: { dbName, schema, version }`を保持する。

---
Change Log:
- 2026-01-30: 初版作成（app移管・store化の実装計画を明文化）。
- 2026-01-30: 実装完了状況を反映（progress/observations更新）。
```
