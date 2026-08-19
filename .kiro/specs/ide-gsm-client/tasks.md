# Implementation Plan: ide-gsm-client

> [!IMPORTANT]
> Status: historical baseline. Completed items describe the initial client surface and do not represent completion of the current mutation, input, task-status, credential, or IDE-GSM Step 4 contract. See [`docs/yaml-plugin-ide-gsm-step4-spec.md`](../../../docs/yaml-plugin-ide-gsm-step4-spec.md).

## Overview

`@hierarchidb/ide-gsm-client` パッケージを新規作成する。
型定義 → IdeGsmClient 実装 → 設定ファイル → PBT の順に積み上げ、
最後にすべてのテストが通ることを確認する。

## Tasks

- [x] 1. 型定義ファイルの作成（ideGsmTypes.ts）
  - `packages/ide-gsm-client/src/ideGsmTypes.ts` を作成する
  - `TaskStatus`（`'FINISHED' | 'FAILED' | 'CANCELED'`）型を定義する
  - `TaskResult`（`id`, `status`, `paramsJson`）インターフェースを定義する
  - `ExportFilter`（`include?`, `exclude?`）インターフェースを定義する
  - _Requirements: 1.1, 6.2, 5.2, 5.3_

- [x] 2. IdeGsmClient 実装（IdeGsmClient.ts）
  - [x] 2.1 内部ヘルパー関数の実装
    - `packages/ide-gsm-client/src/IdeGsmClient.ts` を作成する
    - `deriveWsUrl(endpointUrl: string): string` を実装する（`http` → `ws`、`https` → `wss`、パス `/graphql` を付与）
    - `buildAuthHeaders(authToken: string)` を実装する（`Authorization: Bearer <token>`）
    - _Requirements: 1.3, 1.4_

  - [x] 2.2 コンストラクタと mutation メソッドの実装
    - `IdeGsmClient` クラスとコンストラクタ（`endpointUrl`, `authToken`）を実装する
    - `importProject(projectSnapshot, projectRelativePath): Promise<string>` を実装する
    - `calibrate(projectRelativePath): Promise<string>` を実装する
    - `simulate(projectRelativePath): Promise<string>` を実装する
    - `exportProject(projectRelativePath, filter?): Promise<string>` を実装する（`include`/`exclude` は定義時のみ variables に含める）
    - 各メソッドは `graphql-request` の `GraphQLClient` を使用し、エラーは再スローする
    - non-null assertion（`!`）禁止
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 7.1, 7.2_

  - [x] 2.3 awaitTask メソッドの実装
    - `awaitTask(taskId: string): Promise<TaskResult>` を実装する
    - `graphql-ws` の `createClient` で WebSocket 接続を開き `subscribeTaskOnFrontend` を購読する
    - `FINISHED` 受信時: `TaskResult` で resolve し subscription を閉じる
    - `FAILED` / `CANCELED` 受信時: `Error(\`Task ${taskId} failed with status <status>\`)` をスローする
    - WebSocket が terminal status 受信前に閉じた場合: `Error(\`WebSocket closed before task ${taskId} completed\`)` をスローする
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 7.3_

- [x] 3. エントリポイントと設定ファイルの作成
  - [x] 3.1 index.ts の作成
    - `packages/ide-gsm-client/src/index.ts` を作成し、`IdeGsmClient` と型を re-export する
    - _Requirements: 1.1_

  - [x] 3.2 package.json の作成
    - `packages/ide-gsm-client/package.json` を作成する（`yaml-api` パターンに準拠）
    - `name: "@hierarchidb/ide-gsm-client"`、`type: "module"` を設定する
    - dependencies: `graphql-request`, `graphql-ws`
    - peerDependencies: `graphql`
    - devDependencies: `fast-check`, `vitest`, `typescript`
    - scripts: `build`, `clean`, `typecheck`, `test`, `test:run`
    - _Requirements: 1.1_

  - [x] 3.3 tsconfig.json / tsconfig.typecheck.json / vitest.config.ts の作成
    - `tsconfig.json` を `yaml-api` パターンに準拠して作成する
    - `tsconfig.typecheck.json` を作成する（`__tests__` を含める）
    - `vitest.config.ts` を作成する（`globals: true`, `environment: 'node'`, `include: ['__tests__/**/*.ts']`）
    - _Requirements: 1.1_

- [x] 4. Property-Based Tests の実装（IdeGsmClient.test.ts）
  - [x] 4.1 テストファイルの骨格と P1 の実装
    - `packages/ide-gsm-client/__tests__/IdeGsmClient.test.ts` を作成する
    - 相対 import を使用する（`~/` 禁止）
    - コメント形式: `// Feature: ide-gsm-client, Property N: <text>`
    - P1: `http://` → `ws://`、`https://` → `wss://` のスキーム変換を検証する
    - `fc.assert(fc.property(...), { numRuns: 100 })` を使用する
    - _Requirements: 1.4_

  - [ ]* 4.2 P2: HTTP リクエストの URL と認証ヘッダー検証
    - `graphql-request` をモックし、任意の `endpointUrl` + `authToken` で URL と `Authorization` ヘッダーを検証する
    - _Requirements: 1.2, 1.3_

  - [ ]* 4.3 P3: mutation round-trip — 返却 taskId の一致検証
    - モックサーバーが返す任意の `taskId` と各 mutation メソッドの戻り値が一致することを検証する
    - _Requirements: 2.2, 3.2, 4.2, 5.5_

  - [ ]* 4.4 P4: HTTP / GraphQL エラー時の throw 検証
    - ネットワーク失敗・非 2xx・GraphQL errors 配列の各ケースで必ず throw することを検証する
    - _Requirements: 2.3, 3.3, 4.3, 5.6, 7.1, 7.2_

  - [ ]* 4.5 P5: ExportFilter フィールドの include/omit 検証
    - 任意の `ExportFilter` 組み合わせで variables オブジェクトの形状が正しいことを検証する
    - _Requirements: 5.2, 5.3, 5.4_

  - [ ]* 4.6 P6: awaitTask round-trip identity 検証
    - FINISHED イベントを持つ任意の `taskId` で `result.id === taskId` を検証する
    - _Requirements: 6.2, 6.6_

  - [ ]* 4.7 P7: FAILED / CANCELED 時の throw 検証
    - 任意の `taskId` で FAILED / CANCELED 受信時に throw し、メッセージに `taskId` と status が含まれることを検証する
    - _Requirements: 6.3, 6.4_

  - [ ]* 4.8 P8: WebSocket 予期せぬクローズ時の throw 検証
    - terminal status 受信前に WebSocket が閉じた場合に throw することを検証する
    - _Requirements: 6.5, 7.3_

- [x] 5. チェックポイント — 全テスト通過確認
  - Ensure all tests pass, ask the user if questions arise.
  - `pnpm -w turbo run test --filter @hierarchidb/ide-gsm-client` を実行して全テストが通ることを確認する

## Notes

- `*` 付きサブタスクはオプション（MVP では省略可）
- non-null assertion（`!`）は全ファイルで禁止（AGENTS.md）
- `src/index.ts` 以外での re-export 禁止
- テストファイルは相対 import を使用（`~/` 禁止）
- Property テストコメント形式: `// Feature: ide-gsm-client, Property N: <text>`
- ファイル命名は `docs/ts-file-naming-guideline.md` に従う
