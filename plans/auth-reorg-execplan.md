# Auth package reorganization (auth-api/auth split)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This ExecPlan must be maintained in accordance with `PLANS.md` in the repository root.

## Purpose / Big Picture

auth 周りの責務が分散し、auth-recovery は名称と実態が一致せず、auth-api は薄く、common/auth は役割が曖昧である。これを `packages/`（型と契約）と `packages/`（実装）に整理し、`packages/common/auth` を完全廃止する。ユーザー視点では、認証が必要なダウンロードやバッチ処理の挙動は変えず、依存関係を明確にする。作業後は、auth の型は auth-api から、認証処理や通知の実装は auth から参照されることを確認できる。

## Progress

- [x] (2026-01-31 01:40Z) ExecPlan を作成する。
- [x] (2026-01-31 02:05Z) auth-recovery / auth-api / common/auth の責務と参照箇所を棚卸しする。
- [x] (2026-01-31 02:12Z) auth-api/auth の分担（型と実装）を確定し、移行対象の API 一覧を作成する。
- [x] (2026-01-31 02:28Z) 新 auth パッケージ作成、auth-recovery/common-auth の実装移管と削除を実施する。
- [x] (2026-01-31 02:36Z) 参照更新と依存関係の修正（package.json, tsconfig, vite alias, plugin registry）を完了する。
- [x] (2026-01-31 03:05Z) 型チェックと必要なテストを通し、retired local task log のログを完了に更新する。

## Surprises & Discoveries

- Observation: `packages/common/auth` は BroadcastChannel を使う通知レジストリと通知生成ロジックを持ち、UI と Worker の双方から参照されている。
  Evidence: `packages/common/auth/src/AuthNotificationSystem.ts`。
- Observation: `packages/-recovery` は AuthService を中心にしており、認証通知の生成・dispatch も含むため名称が責務と一致していない。
  Evidence: `packages/-recovery/src/AuthService.ts`。
- Observation: 通知型は UI と Worker の契約として再利用されるため、実装ではなく auth-api に移すのが合理的だった。
  Evidence: `packages//src/AuthNotificationSystem.ts` が `@hierarchidb/auth-api` の型を参照している。

## Decision Log

- Decision: `@hierarchidb/common-auth` は完全廃止し、通知システムは `@hierarchidb/auth` に移す。
  Rationale: 実装を集約し、auth-api には型のみを残すため。
  Date/Author: 2026-01-31 / Codex.
- Decision: `@hierarchidb/auth-recovery` は廃止し、AuthService は `@hierarchidb/auth` に移す。
  Rationale: 実際の責務は recovery に限定されず、auth 実装の中心であるため。
  Date/Author: 2026-01-31 / Codex.
- Decision: Auth 通知関連の型は `@hierarchidb/auth-api` に集約し、実装は `@hierarchidb/auth` に置く。
  Rationale: UI/Worker 間の契約は型として共有し、実装は auth に閉じるため。
  Date/Author: 2026-01-31 / Codex.

## Outcomes & Retrospective

- Outcome: auth 実装を `@hierarchidb/auth` に集約し、契約型を `@hierarchidb/auth-api` に移動した。common-auth/auth-recovery は削除し、依存と import を更新した。
- Outcome: `@hierarchidb/auth-api` / `@hierarchidb/auth` の build と主要 typecheck が成功した。
- Remaining: 生成ドキュメントの更新が必要になった場合は、専用生成手順で再生成する。

## Context and Orientation

現在の構成は以下（移行後の状態）。

- `packages/` は AuthService / AuthRecoveryService と AuthNotificationSystem（registry/factory/guards）を提供する。
- `packages/` は AuthRuntimeBridge と AuthScope/AuthContext/AuthHeadersProvider などの契約型、通知型（AuthRequired/AuthSuccess/AuthCancelled）を提供する。
- `packages/common/auth` と `packages/-recovery` は削除済みであり、参照は `@hierarchidb/auth` / `@hierarchidb/auth-api` に置換されている。

主な参照箇所（抜粋）。

- `@hierarchidb/auth-recovery` を参照する実装: `packages/runtime-worker/src/services/downloadAdapter.ts`, `packages//src/*`, `plugins/shape-plugin/src/ui/workers/countryAvailability.worker.ts`, `plugins/spreadsheet-plugin/src/services/SpreadsheetTabularApiDriver.ts` など。
- `@hierarchidb/common-auth` を参照する実装: `packages/ui/auth/src/services/UIAuthRecoveryClient.ts`, `plugins/location-plugin/src/common/hooks/useLocationProgress.ts` など。
- Vite alias: `app/vite.config.ts` に `@hierarchidb/common-auth` / `@hierarchidb/auth-recovery` のパス解決がある。

## Plan of Work

まず、`packages/` を新設し、`common/auth` と `auth-recovery` の実装をこちらに集約する。`AuthNotificationSystem` と `AuthService`（および互換用 `AuthRecoveryService`）は `@hierarchidb/auth` に移動する。`auth-api` は型専用パッケージとして維持し、`AuthRuntimeBridge` に加えて必要な型（`AuthScope`, `AuthContext`, `AuthHeadersProvider` など）を整理して配置する。`common/auth` は削除し、参照をすべて `@hierarchidb/auth` へ置換する。`auth-recovery` は削除し、参照を `@hierarchidb/auth` に置換する。

次に、依存関係とビルド設定を更新する。`package.json` の dependencies/peerDependencies/devDependencies を修正し、`tsconfig.base.json` の paths と `app/vite.config.ts` の alias を新パッケージへ合わせる。`plugin-registry` の生成物に `common-auth` が残るので、`pnpm tools:gen-plugin-registry` を実行して整合させる。

最後に、型チェックと必要なテストを実行し、動作確認を行う。`app` と `runtime-worker`、`features/download`、`ui/auth` の typecheck を優先し、既存の認証フロー（AuthRequired ダイアログ）を UI で確認できる状態まで持っていく。

## Concrete Steps

1) 既存パッケージの棚卸しと移行先の対応表を作成する。
   - 対象: `packages/-recovery/src/*`, `packages/common/auth/src/*`, `packages//src/*`。

2) `packages/` を新設する。
   - 新規 `packages//package.json`, `src/index.ts`, `src/AuthService.ts`, `src/AuthNotificationSystem.ts` を作成。
   - `AuthService` と `AuthRecoveryService` を `auth-recovery` から移動。
   - `AuthNotificationSystem` を `common/auth` から移動。

3) `packages/` を型専用に整理する。
   - `AuthRuntimeBridge` に加えて、`AuthScope` / `AuthContext` / `AuthHeadersProvider` などの型の所在を統一。

4) 参照更新と削除。
   - `@hierarchidb/auth-recovery` と `@hierarchidb/common-auth` の import を `@hierarchidb/auth` へ置換。
   - `packages/common/auth` と `packages/-recovery` を削除。
   - `package.json` の依存を新パッケージへ統一。

5) 設定更新。
   - `tsconfig.base.json` の paths に `@hierarchidb/auth` と `@hierarchidb/auth-api` を追加し、旧パスを削除。
   - `app/vite.config.ts` の alias で `@hierarchidb/auth` へ更新。
   - `pnpm tools:gen-plugin-registry` を実行し generated registry を更新。

## Validation and Acceptance

- 代表的な型チェック:
  - `pnpm --filter @hierarchidb/app typecheck`
  - `pnpm --filter @hierarchidb/runtime-worker typecheck`
  - `pnpm --filter @hierarchidb/features-download typecheck`（該当パッケージ名に合わせて実行）
  - `pnpm --filter @hierarchidb/ui-auth typecheck`
- 代表的な動作確認:
  - 認証が必要なデータソースを読み込み、AuthRequired ダイアログが表示されること。
  - ログで `AuthNotificationRegistry` が登録・dispatch されること（`hidb_auth_debug` 有効時）。

## Idempotence and Recovery

- 移行は差分ごとに小さく進める。途中で失敗した場合は、削除前のパッケージを一時的に残して build を通し、参照の置換を段階的に行う。
- 重大な破壊が起きた場合は、`git revert` で直前の移行コミットを戻す。

## Artifacts and Notes

- 主要ファイルの移動元/移動先を記録する。
  - 例: `packages/common/auth/src/AuthNotificationSystem.ts` -> `packages//src/AuthNotificationSystem.ts`
  - 例: `packages/-recovery/src/AuthService.ts` -> `packages//src/AuthService.ts`

## Interfaces and Dependencies

- 新パッケージ `@hierarchidb/auth` は実装を提供する。
  - 必須エクスポート: `AuthService`, `AuthRecoveryService`, `AuthNotificationRegistry`, `AuthNotificationFactory`, `AuthNotificationGuards`, `AUTH_CONSTANTS`, `detectAuthSource`, `generateRequestId`, など。
- `@hierarchidb/auth-api` は型専用。
  - 必須エクスポート: `AuthRuntimeBridge`, `AuthScope`, `AuthContext`, `AuthHeadersProvider`。

Note: This plan was created because `packages/common/auth` must be fully removed and auth responsibilities consolidated into `auth-api`/`auth`.

Plan Update: 2026-01-31 - Updated progress, context, and decisions after moving auth notification types into auth-api and implementing the package migration steps.
Plan Update: 2026-01-31 - Marked validation complete and summarized outcomes after running builds/typechecks.
