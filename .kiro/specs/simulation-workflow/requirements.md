# 要件定義書

## はじめに

`SimulationWorkflow` は、hierarchidb のノード群を IDE-GSM プロジェクトとして扱い、
import → calibrate → simulate → export の 4 ステップを順次実行するワークフロークラスである。

既存の `IdeGsmClient`（`@hierarchidb/ide-gsm-client`）と
`exportYamlNodesToSnapshot` / `importYamlNodesFromSnapshot`（`@hierarchidb/folder-plugin`）を組み合わせ、
新規パッケージ `packages/simulation-workflow`（`@hierarchidb/simulation-workflow`）として実装する。

---

## 用語集

- **SimulationWorkflow**: 本機能の中心クラス。`IdeGsmClient` を保持し、シミュレーションの全ステップを順次実行する。
- **IdeGsmClient**: IDE-GSM GraphQL API を呼び出すクライアントクラス（`@hierarchidb/ide-gsm-client`）。
- **ExportableNode**: YAML ノードのエクスポート対象を表す型（`@hierarchidb/folder-plugin`）。
- **ProjectSnapshot**: ZIP を Base64 エンコードしたプロジェクトスナップショット文字列。
- **ProjectRelativePath**: IDE-GSM 上のプロジェクト相対パス（文字列）。
- **ExportFilter**: `exportProject` に渡すファイルフィルタ（`include` / `exclude` グロブパターン配列）。
- **RsyncFilter**: `rsyncPush` / `rsyncPull` に渡すファイルフィルタ（`include` / `exclude` グロブパターン配列）。
- **ConnectionType**: rsync の接続種別。`'remote' | 'ssh' | 'ec2'` のいずれか。
- **StepName**: ワークフローの各ステップ名。`'import' | 'calibrate' | 'simulate' | 'export' | 'rsync-push' | 'rsync-pull'` のいずれか。
- **StepStatus**: 各ステップの状態。`'running' | 'done' | 'failed'` のいずれか。
- **OnStepChange**: ステップ状態変化を通知するコールバック型。`(step: StepName, status: StepStatus) => void`。

---

## 要件

### 要件 1: ワークフローの初期化

**ユーザーストーリー:** 開発者として、`IdeGsmClient` インスタンスを注入して `SimulationWorkflow` を生成したい。そうすることで、接続先や認証設定を外部から制御できる。

#### 受け入れ基準

1. THE SimulationWorkflow SHALL accept an `IdeGsmClient` instance as a constructor argument.
2. THE SimulationWorkflow SHALL store the provided `IdeGsmClient` instance for use in all workflow steps.

---

### 要件 2: シリアライズ（ノード → ProjectSnapshot）

**ユーザーストーリー:** 開発者として、`ExportableNode[]` を ProjectSnapshot（ZIP Base64）に変換したい。そうすることで、IDE-GSM にインポートできる形式でデータを渡せる。

#### 受け入れ基準

1. WHEN `runSimulation` is called with a non-empty `nodes` array, THE SimulationWorkflow SHALL serialize the nodes into a ProjectSnapshot string using `exportYamlNodesToSnapshot`.
2. WHEN `exportYamlNodesToSnapshot` returns an error result, THEN THE SimulationWorkflow SHALL throw an error with the error message from the result and SHALL NOT proceed to subsequent steps.
3. THE SimulationWorkflow SHALL pass the serialized ProjectSnapshot to `IdeGsmClient.importProject` as the first argument.

---

### 要件 3: import ステップの実行

**ユーザーストーリー:** 開発者として、ProjectSnapshot を IDE-GSM にインポートしたい。そうすることで、IDE-GSM 側でプロジェクトを復元できる。

#### 受け入れ基準

1. WHEN the serialization step succeeds, THE SimulationWorkflow SHALL call `IdeGsmClient.importProject(projectSnapshot, projectRelativePath)` and then call `IdeGsmClient.awaitTask(taskId)` to wait for completion.
2. WHEN the import step starts, THE SimulationWorkflow SHALL invoke `OnStepChange('import', 'running')`.
3. WHEN `awaitTask` resolves for the import step, THE SimulationWorkflow SHALL invoke `OnStepChange('import', 'done')`.
4. IF `importProject` or `awaitTask` throws during the import step, THEN THE SimulationWorkflow SHALL invoke `OnStepChange('import', 'failed')` and SHALL throw the error without executing subsequent steps.

---

### 要件 4: calibrate ステップの実行

**ユーザーストーリー:** 開発者として、インポート完了後にキャリブレーションを実行したい。そうすることで、シミュレーション前の調整を自動化できる。

#### 受け入れ基準

1. WHEN the import step completes successfully, THE SimulationWorkflow SHALL call `IdeGsmClient.calibrate(projectRelativePath)` and then call `IdeGsmClient.awaitTask(taskId)` to wait for completion.
2. WHEN the calibrate step starts, THE SimulationWorkflow SHALL invoke `OnStepChange('calibrate', 'running')`.
3. WHEN `awaitTask` resolves for the calibrate step, THE SimulationWorkflow SHALL invoke `OnStepChange('calibrate', 'done')`.
4. IF `calibrate` or `awaitTask` throws during the calibrate step, THEN THE SimulationWorkflow SHALL invoke `OnStepChange('calibrate', 'failed')` and SHALL throw the error without executing subsequent steps.

---

### 要件 5: simulate ステップの実行

**ユーザーストーリー:** 開発者として、キャリブレーション完了後にシミュレーションを実行したい。そうすることで、シミュレーション結果を取得できる。

#### 受け入れ基準

1. WHEN the calibrate step completes successfully, THE SimulationWorkflow SHALL call `IdeGsmClient.simulate(projectRelativePath)` and then call `IdeGsmClient.awaitTask(taskId)` to wait for completion.
2. WHEN the simulate step starts, THE SimulationWorkflow SHALL invoke `OnStepChange('simulate', 'running')`.
3. WHEN `awaitTask` resolves for the simulate step, THE SimulationWorkflow SHALL invoke `OnStepChange('simulate', 'done')`.
4. IF `simulate` or `awaitTask` throws during the simulate step, THEN THE SimulationWorkflow SHALL invoke `OnStepChange('simulate', 'failed')` and SHALL throw the error without executing subsequent steps.

---

### 要件 6: export ステップの実行

**ユーザーストーリー:** 開発者として、シミュレーション完了後に結果を ProjectSnapshot としてエクスポートしたい。そうすることで、呼び出し元が結果を hierarchidb に格納できる。

#### 受け入れ基準

1. WHEN the simulate step completes successfully, THE SimulationWorkflow SHALL call `IdeGsmClient.exportProject(projectRelativePath, exportFilter?)` and then call `IdeGsmClient.awaitTask(taskId)` to wait for completion.
2. WHEN `exportFilter` is provided, THE SimulationWorkflow SHALL pass it to `IdeGsmClient.exportProject` as the second argument.
3. WHEN `exportFilter` is not provided, THE SimulationWorkflow SHALL call `IdeGsmClient.exportProject` without a second argument so that IDE-GSM applies its default filter.
4. WHEN the export step starts, THE SimulationWorkflow SHALL invoke `OnStepChange('export', 'running')`.
5. WHEN `awaitTask` resolves for the export step, THE SimulationWorkflow SHALL invoke `OnStepChange('export', 'done')`.
6. IF `exportProject` or `awaitTask` throws during the export step, THEN THE SimulationWorkflow SHALL invoke `OnStepChange('export', 'failed')` and SHALL throw the error.

---

### 要件 7: 戻り値（ProjectSnapshot）

**ユーザーストーリー:** 開発者として、`runSimulation` の戻り値としてエクスポート結果の ProjectSnapshot を受け取りたい。そうすることで、`importYamlNodesFromSnapshot` を使って結果を hierarchidb に格納できる。

#### 受け入れ基準

1. WHEN all four steps complete successfully, THE SimulationWorkflow SHALL return the ProjectSnapshot string obtained from the export step's `TaskResult.paramsJson`.
2. FOR ALL successful `runSimulation` calls, the returned ProjectSnapshot SHALL be a non-empty string.

---

### 要件 8: ステップ順序の保証

**ユーザーストーリー:** 開発者として、各ステップが必ず前のステップの完了後に実行されることを保証したい。そうすることで、依存関係のある処理が正しい順序で実行される。

#### 受け入れ基準

1. THE SimulationWorkflow SHALL execute steps in the fixed order: import → calibrate → simulate → export.
2. THE SimulationWorkflow SHALL NOT start a subsequent step until `awaitTask` for the current step has resolved.
3. IF any step throws an error, THEN THE SimulationWorkflow SHALL NOT execute any subsequent steps.

---

### 要件 9: ステップ進捗コールバック

**ユーザーストーリー:** 開発者として、各ステップの開始・完了・失敗をコールバックで受け取りたい。そうすることで、UI にリアルタイムで進捗を表示できる。

#### 受け入れ基準

1. WHEN `runSimulation` is called with an `onStepChange` callback, THE SimulationWorkflow SHALL invoke the callback at the start of each step with status `'running'`.
2. WHEN a step completes successfully, THE SimulationWorkflow SHALL invoke the callback with status `'done'`.
3. WHEN a step fails, THE SimulationWorkflow SHALL invoke the callback with status `'failed'` before throwing the error.
4. WHEN `runSimulation` is called without an `onStepChange` callback, THE SimulationWorkflow SHALL execute all steps without invoking any callback.
5. FOR ALL steps, THE SimulationWorkflow SHALL invoke `OnStepChange` with exactly one `'running'` event followed by exactly one `'done'` or `'failed'` event per step execution.

---

### 要件 10: エラー処理

**ユーザーストーリー:** 開発者として、いずれかのステップでエラーが発生した場合に後続ステップが実行されないことを保証したい。そうすることで、不整合な状態での処理継続を防げる。

#### 受け入れ基準

1. IF any step throws an error, THEN THE SimulationWorkflow SHALL propagate the error to the caller of `runSimulation` without modification.
2. IF any step throws an error, THEN THE SimulationWorkflow SHALL NOT invoke `OnStepChange` for any subsequent step.
3. THE SimulationWorkflow SHALL NOT swallow or suppress any error from `IdeGsmClient` methods or `exportYamlNodesToSnapshot`.

---

### 要件 11: rsync フローの実行

**ユーザーストーリー:** 開発者として、rsync-push → calibrate → simulate → rsync-pull のフローを実行したい。そうすることで、ZIP を使わずにリモートサーバーとファイルを同期しながらシミュレーションを実行できる。

#### 受け入れ基準

1. THE SimulationWorkflow SHALL provide a `runSimulationWithRsync(projectRelativePath, connectionType, rsyncFilter?, onStepChange?)` method.
2. WHEN `runSimulationWithRsync` is called, THE SimulationWorkflow SHALL execute steps in the fixed order: rsync-push → calibrate → simulate → rsync-pull.
3. WHEN the rsync-push step starts, THE SimulationWorkflow SHALL invoke `OnStepChange('rsync-push', 'running')`.
4. WHEN the rsync-push step completes, THE SimulationWorkflow SHALL invoke `OnStepChange('rsync-push', 'done')`.
5. WHEN the rsync-pull step starts, THE SimulationWorkflow SHALL invoke `OnStepChange('rsync-pull', 'running')`.
6. WHEN the rsync-pull step completes, THE SimulationWorkflow SHALL invoke `OnStepChange('rsync-pull', 'done')`.
7. IF any step throws an error, THEN THE SimulationWorkflow SHALL invoke `OnStepChange` with `'failed'` for that step and SHALL NOT execute subsequent steps.

---

### 要件 12: IdeGsmClient の rsync メソッド拡張

**ユーザーストーリー:** 開発者として、`IdeGsmClient` から rsyncPush / rsyncPull を呼び出したい。

#### 受け入れ基準

1. THE IdeGsmClient SHALL provide a `rsyncPush(projectRelativePath, connectionType, filter?)` method that returns a taskId string.
2. THE IdeGsmClient SHALL provide a `rsyncPull(projectRelativePath, connectionType, filter?)` method that returns a taskId string.
3. THE `connectionType` parameter SHALL accept `"remote"` | `"ssh"` | `"ec2"`.
