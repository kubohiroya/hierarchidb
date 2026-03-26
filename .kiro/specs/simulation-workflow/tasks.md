# Implementation Plan: simulation-workflow

## Overview

`ide-gsm-client` に rsync メソッドを追加し、新規パッケージ `simulation-workflow` を実装する。
実装言語は TypeScript。

## Tasks

- [x] 1. ide-gsm-client に rsync 型と GraphQL ミューテーションを追加する
  - [x] 1.1 `packages/ide-gsm-client/src/ideGsmTypes.ts` に `ConnectionType` と `RsyncFilter` 型を追加する
    - `ConnectionType = 'remote' | 'ssh' | 'ec2'`
    - `RsyncFilter { include?: string[]; exclude?: string[] }`
    - _Requirements: 12.3_
  - [x] 1.2 `packages/ide-gsm-client/src/IdeGsmClient.ts` に `rsyncPush` / `rsyncPull` メソッドを追加する
    - GraphQL mutation `RsyncPush` / `RsyncPull` を定義し、`RsyncInput` 変数を組み立てる
    - `filter` が省略された場合は `include` / `exclude` を variables に含めない
    - non-null assertion (`!`) 禁止
    - _Requirements: 12.1, 12.2, 12.3_
  - [ ]* 1.3 Property test: rsync taskId passthrough (P8)
    - `// Feature: simulation-workflow, Property 8: rsync mutation taskId passthrough`
    - **Property 8: Rsync mutation taskId passthrough**
    - **Validates: Requirements 12.1, 12.2**
  - [ ]* 1.4 Property test: connectionType forwarding (P9)
    - `// Feature: simulation-workflow, Property 9: ConnectionType is forwarded to rsync mutations`
    - **Property 9: ConnectionType is forwarded to rsync mutations**
    - **Validates: Requirements 12.3**
  - [x] 1.5 `packages/ide-gsm-client/src/index.ts` に `ConnectionType` / `RsyncFilter` を re-export する
    - _Requirements: 12.1, 12.2, 12.3_

- [x] 2. simulation-workflow パッケージの設定ファイルを作成する
  - `packages/simulation-workflow/package.json` を作成する
    - name: `@hierarchidb/simulation-workflow`
    - dependencies: `@hierarchidb/ide-gsm-client: workspace:*`, `@hierarchidb/folder-plugin: workspace:*`
    - devDependencies: `fast-check`, `vitest`, `typescript`
  - `packages/simulation-workflow/tsconfig.json` / `tsconfig.typecheck.json` を作成する
  - `packages/simulation-workflow/vitest.config.ts` を作成する
    - `globals: true`, `environment: 'node'`, `include: ['__tests__/**/*.ts']`
  - _Requirements: 1.1_

- [x] 3. simulation-workflow の型定義を作成する
  - `packages/simulation-workflow/src/simulationWorkflowTypes.ts` を作成する
    - `StepName = 'import' | 'calibrate' | 'simulate' | 'export' | 'rsync-push' | 'rsync-pull'`
    - `StepStatus = 'running' | 'done' | 'failed'`
    - `OnStepChange = (step: StepName, status: StepStatus) => void`
    - `RsyncFilter { include?: string[]; exclude?: string[] }`
    - `ConnectionType = 'remote' | 'ssh' | 'ec2'`
    - _Requirements: 9.1, 11.1_

- [x] 4. SimulationWorkflow クラスを実装する
  - [x] 4.1 `packages/simulation-workflow/src/SimulationWorkflow.ts` にクラス骨格とコンストラクタを実装する
    - `IdeGsmClient` を constructor 引数として受け取り、private フィールドに格納する
    - non-null assertion (`!`) 禁止
    - _Requirements: 1.1, 1.2_
  - [x] 4.2 `runSimulation` メソッドを実装する
    - `exportYamlNodesToSnapshot` でシリアライズ → エラー時は即 throw（`onStepChange` 呼び出しなし）
    - import → calibrate → simulate → export の順に各ステップを実行する
    - 各ステップ: `onStepChange(step, 'running')` → mutation → `awaitTask` → `onStepChange(step, 'done')`
    - エラー時: `onStepChange(step, 'failed')` → re-throw（後続ステップ実行しない）
    - `exportFilter` が省略された場合は `exportProject` に渡さない
    - 戻り値は export ステップの `TaskResult.paramsJson`
    - `onStepChange` が省略された場合はコールバックを呼ばない
    - _Requirements: 2.1, 2.2, 2.3, 3.1–3.4, 4.1–4.4, 5.1–5.4, 6.1–6.6, 7.1, 7.2, 8.1–8.3, 9.1–9.5, 10.1–10.3_
  - [ ]* 4.3 Property test: import flow step order invariant (P1)
    - `// Feature: simulation-workflow, Property 1: Import flow step order invariant`
    - **Property 1: Import flow step order invariant**
    - **Validates: Requirements 3.2, 3.3, 4.2, 4.3, 5.2, 5.3, 6.4, 6.5, 8.1, 9.1, 9.2, 9.5**
  - [ ]* 4.4 Property test: error stops subsequent steps (P3) — runSimulation
    - `// Feature: simulation-workflow, Property 3: Error stops subsequent steps`
    - **Property 3: Error stops subsequent steps**
    - **Validates: Requirements 3.4, 4.4, 5.4, 6.6, 8.3, 10.2**
  - [ ]* 4.5 Property test: error propagation without modification (P4) — runSimulation
    - `// Feature: simulation-workflow, Property 4: Error propagation without modification`
    - **Property 4: Error propagation without modification**
    - **Validates: Requirements 10.1, 10.3**
  - [ ]* 4.6 Property test: serialization error prevents any step execution (P5)
    - `// Feature: simulation-workflow, Property 5: Serialization error prevents any step execution`
    - **Property 5: Serialization error prevents any step execution**
    - **Validates: Requirements 2.2**
  - [ ]* 4.7 Property test: ExportFilter passthrough (P6)
    - `// Feature: simulation-workflow, Property 6: ExportFilter passthrough`
    - **Property 6: ExportFilter passthrough**
    - **Validates: Requirements 6.2, 6.3**
  - [ ]* 4.8 Property test: export result round-trip (P7)
    - `// Feature: simulation-workflow, Property 7: Export result round-trip`
    - **Property 7: Export result round-trip**
    - **Validates: Requirements 7.1**
  - [x] 4.9 `runSimulationWithRsync` メソッドを実装する
    - rsync-push → calibrate → simulate → rsync-pull の順に各ステップを実行する
    - 各ステップのコールバック・エラー処理は `runSimulation` と同じパターンに従う
    - `rsyncFilter` が省略された場合は `rsyncPush` / `rsyncPull` に渡さない
    - _Requirements: 11.1–11.7_
  - [ ]* 4.10 Property test: rsync flow step order invariant (P2)
    - `// Feature: simulation-workflow, Property 2: Rsync flow step order invariant`
    - **Property 2: Rsync flow step order invariant**
    - **Validates: Requirements 11.2, 11.3, 11.4, 11.5, 11.6**
  - [ ]* 4.11 Property test: error stops subsequent steps (P3) — runSimulationWithRsync
    - `// Feature: simulation-workflow, Property 3: Error stops subsequent steps`
    - **Property 3: Error stops subsequent steps (rsync flow)**
    - **Validates: Requirements 11.7, 8.3, 10.2**

- [x] 5. エントリポイントを作成する
  - `packages/simulation-workflow/src/index.ts` を作成する
    - `SimulationWorkflow` / `StepName` / `StepStatus` / `OnStepChange` / `RsyncFilter` / `ConnectionType` を re-export する
  - _Requirements: 1.1_

- [x] 6. Checkpoint — 全テスト通過確認
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- `*` 付きサブタスクはオプション（MVP では省略可）
- non-null assertion (`!`) は全ファイルで禁止（AGENTS.md 準拠）
- テストファイルは相対 import を使用（`~/` 禁止）
- Property テストコメント形式: `// Feature: simulation-workflow, Property N: <text>`
- 各 property test は `fc.assert(fc.property(...), { numRuns: 100 })` を最低反復数とする
