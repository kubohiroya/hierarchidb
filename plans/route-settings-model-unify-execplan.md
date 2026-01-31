# Route設定モデル統合

このExecPlanは生きたドキュメントです。`Progress`、`Surprises & Discoveries`、`Decision Log`、`Outcomes & Retrospective` を作業の進行に合わせて更新します。

このExecPlanは `PLANS.md` の規約に従って維持されます。参照先はリポジトリ直下の `PLANS.md` です。

## Purpose / Big Picture

Routeプラグインの設定値が `draftData.processing` と `draftData.buildConfig` に分散しているため、UIとWorkerが同じ設定を参照できず重複や不整合が発生しています。ここでは、設定モデルを `buildConfig` に統一し、既存データは安全に移行されるようにすることで、設定UIと実行パスが同一の情報源を使う状態を実現します。ユーザーは設定ステップで入力した内容が確実にビルド処理へ反映され、同じ設定が再訪時にも保持されることを確認できます。

## Progress

- [x] (2026-01-29 22:25 JST) 設定モデル統合の設計と既存参照の棚卸しを完了する。
- [x] (2026-01-29 22:35 JST) 既存データの移行ロジックを実装し、UI/Workerの参照先を `buildConfig` に統一する。
- [x] (2026-01-29 22:40 JST) 不要になった `processing` 参照を撤去し、型と保存ロジックを整理する。
- [x] (2026-01-29 22:50 JST) 検証（typecheck）を通し、変更内容を運用ログに記録する。

## Surprises & Discoveries

- Observation: route-store は route-api を再エクスポートしており、型定義の正は route-api 側だった。
  Evidence: packages/features/route-store/src/index.ts で '@hierarchidb/route-api' を export。

## Decision Log

- Decision: Route設定の単一情報源を `buildConfig` にする。
  Rationale: Shapeと共通化済みのUIコンポーネントが `BaseBuildConfig` を前提としているため。
  Date/Author: 2026-01-29 / Codex

- Decision: `RouteEntity` の非推奨注釈は route-api の型定義へ追加する。
  Rationale: route-store は route-api の再エクスポートであり、型の正は route-api 側。
  Date/Author: 2026-01-29 / Codex

## Outcomes & Retrospective

- Route設定の参照先を buildConfig に統一し、legacy processing からの移行を実装した。型の非推奨注釈を追加し、RouteTileSettingsStep も buildConfig を更新するように整理した。

## Context and Orientation

Routeプラグインの設定は、これまで `RouteProcessingStep` が `draftData.processing` を更新し、別の箇所で `draftData.config` を参照していました。一方、Shapeプラグインでは `buildConfig` を単一の設定モデルとして扱っており、共通UIコンポーネントは `BaseBuildConfig` を前提にしています。

関連ファイルは次の通りです。

- `plugins/route-plugin/src/ui/components/steps/RouteProcessingStep.tsx`。設定UIの実装。現在は `buildConfig` を用いるが、過去の `processing` と併存している可能性がある。
- `plugins/route-plugin/src/ui/components/steps/useRouteBuildConfigStep.ts`。Route設定の初期化と更新を担当するフック。
- `packages/features/route-store/src/routeTypes.ts`。RouteEntityの型。`buildConfig` を追加し、統合後はここを正とする。
- `plugins/route-plugin/src/common/config/buildConfig.ts`。Route用の `BaseBuildConfig` デフォルト値とマージ関数。

このExecPlanでは、`buildConfig` を Route設定の唯一の情報源とし、`processing` は移行用に読み取りのみ行い、最終的に参照箇所を撤去します。

## Plan of Work

まず、Routeプラグイン内で `processing` を参照している箇所を全て特定し、実際に意味のある設定が残っているかを確認します。次に、`useRouteBuildConfigStep` に移行ロジックを追加し、`processing` から `buildConfig` へ必要な値を写像した上で `buildConfig` を確定します。`buildConfig` の初期値は `DEFAULT_ROUTE_BUILD_CONFIG` を使用し、データソース名が存在する場合は反映します。

UI側は `RouteProcessingStep` のみが設定更新を行うよう統一し、`RouteTileSettingsStep` などの残存する `processing` 参照は `buildConfig` に置き換えるか、未使用であれば撤去します。Worker側で `processing` を参照している箇所があれば `buildConfig` に置き換えます。最後に `routeTypes.ts` の型整理を行い、`processing` が残る場合は移行専用フィールドであることが明確になるようコメントと型を整理します。

## Concrete Steps

1) 現状参照の棚卸し。
   - 作業ディレクトリ: `/Users/hiroya/WebstormProjects/hierarchidb`
   - 実行コマンド:
     rg -n "processing" plugins/route-plugin/src
   - 期待結果: `processing` を参照するUI/サービスの一覧が得られる。

2) 移行ロジックの実装。
   - `plugins/route-plugin/src/ui/components/steps/useRouteBuildConfigStep.ts` に、`draftData.processing` や `draftData.config` が存在する場合のマッピングを実装する。
   - `buildConfig` の初期化は `DEFAULT_ROUTE_BUILD_CONFIG` を利用し、可能ならデータソース名を反映する。

3) UI/Worker参照の統一。
   - `RouteTileSettingsStep` などの残存UIで `processing` を参照している箇所を `buildConfig` に置き換える。
   - 不要な `processing` 参照は削除する。

4) 型と保存ロジックの整理。
   - `packages/features/route-store/src/routeTypes.ts` の `processing` フィールドは移行用途であることを明記し、参照箇所を残さない。

5) 検証。
   - `pnpm --filter @hierarchidb/route-plugin typecheck`
   - 期待結果: exit 0。

## Validation and Acceptance

`RouteProcessingStep` で設定した内容が `buildConfig` に保存され、再度ステップを開いても同じ値が表示されることを確認します。`processing` を参照していた画面で設定が欠落しないことが確認できれば合格です。加えて、`pnpm --filter @hierarchidb/route-plugin typecheck` が成功することが必須です。

## Idempotence and Recovery

移行処理は既存 `buildConfig` が存在する場合は上書きしないため、繰り返し実行しても安全です。問題が発生した場合は、該当差分を revert すれば `processing` 参照の旧状態に戻せます。

## Artifacts and Notes

- `rg -n "processing" plugins/route-plugin/src` の結果を必要に応じて `Surprises & Discoveries` に記録する。

## Interfaces and Dependencies

`BaseBuildConfig` と `DEFAULT_ROUTE_BUILD_CONFIG` を使用し、`buildConfig` が設定モデルの唯一の情報源になるよう統一します。`processing` は既存データ移行の読み取り専用に限定し、UI/Workerからは参照しません。依存は `@hierarchidb/gis-sdk` と `@hierarchidb/route-store` を前提にします。

変更履歴: 2026-01-29 22:10 JST 作成（Route設定モデル統合の実装方針を定義）。
