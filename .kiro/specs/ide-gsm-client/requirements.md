# 要件定義書

## はじめに

`IdeGsmClient` は、IDE-GSM の GraphQL API（HTTP mutation および WebSocket subscription）を呼び出すクライアントライブラリである。
hierarchidb 側から `importProject` / `exportProject` / `calibrate` / `simulate` の各 mutation を実行し、非同期タスクの完了を WebSocket subscription で待機する機能を提供する。
新規パッケージ `packages/ide-gsm-client`（`@hierarchidb/ide-gsm-client`）として実装する。

## 用語集

- **IdeGsmClient**: IDE-GSM GraphQL API を呼び出すクライアントクラス。
- **Mutation**: GraphQL の変更操作。HTTP POST で `http://<host>:8080/graphql` に送信する。
- **Subscription**: GraphQL の購読操作。WebSocket（`ws://<host>:8080/graphql`）で接続し、タスク状態変化を受信する。
- **TaskId**: IDE-GSM が mutation レスポンスで返す非同期タスクの識別子（文字列）。
- **TaskStatus**: タスクの状態。`FINISHED` / `FAILED` / `CANCELED` のいずれか。
- **TaskResult**: subscription で受信するタスク完了データ。`id`・`status`・`paramsJson` フィールドを持つ。
- **ExportFilter**: `exportProject` mutation に渡すファイルフィルタ。`include` と `exclude` のグロブパターン配列で構成される。
- **ProjectSnapshot**: `importProject` に渡すプロジェクトスナップショットデータ（文字列）。
- **ProjectRelativePath**: プロジェクトの相対パス（文字列）。
- **AuthToken**: Bearer 認証トークン（文字列）。`Authorization: Bearer <token>` ヘッダーに使用する。
- **EndpointUrl**: IDE-GSM GraphQL エンドポイントのベース URL（例: `http://localhost:8080`）。

---

## 要件

### 要件 1: クライアントの設定管理

**ユーザーストーリー:** 開発者として、接続先 URL と認証トークンを外部から注入できるようにしたい。そうすることで、環境ごとに設定を切り替えられる。

#### 受け入れ基準

1. THE IdeGsmClient SHALL accept an `endpointUrl` string and an `authToken` string as constructor arguments.
2. THE IdeGsmClient SHALL use the `endpointUrl` as the base URL for all GraphQL HTTP requests.
3. THE IdeGsmClient SHALL include an `Authorization: Bearer <authToken>` header in every HTTP request.
4. THE IdeGsmClient SHALL derive the WebSocket endpoint from `endpointUrl` by replacing the `http` scheme with `ws` (and `https` with `wss`).

---

### 要件 2: importProject mutation の呼び出し

**ユーザーストーリー:** 開発者として、プロジェクトスナップショットを IDE-GSM にインポートしたい。そうすることで、IDE-GSM 側でプロジェクトを復元できる。

#### 受け入れ基準

1. WHEN `importProject` is called with a `projectSnapshot` string and a `projectRelativePath` string, THE IdeGsmClient SHALL send an `ImportProject` GraphQL mutation to the endpoint.
2. WHEN the mutation succeeds, THE IdeGsmClient SHALL return the `taskId` string from the response.
3. IF the HTTP request fails or the response contains a GraphQL error, THEN THE IdeGsmClient SHALL throw an error with a descriptive message.

---

### 要件 3: calibrate mutation の呼び出し

**ユーザーストーリー:** 開発者として、プロジェクトのキャリブレーションを IDE-GSM に依頼したい。そうすることで、シミュレーション前の調整を自動化できる。

#### 受け入れ基準

1. WHEN `calibrate` is called with a `projectRelativePath` string, THE IdeGsmClient SHALL send a `Calibrate` GraphQL mutation to the endpoint.
2. WHEN the mutation succeeds, THE IdeGsmClient SHALL return the `taskId` string from the response.
3. IF the HTTP request fails or the response contains a GraphQL error, THEN THE IdeGsmClient SHALL throw an error with a descriptive message.

---

### 要件 4: simulate mutation の呼び出し

**ユーザーストーリー:** 開発者として、プロジェクトのシミュレーションを IDE-GSM に依頼したい。そうすることで、シミュレーション結果を取得できる。

#### 受け入れ基準

1. WHEN `simulate` is called with a `projectRelativePath` string, THE IdeGsmClient SHALL send a `Simulate` GraphQL mutation to the endpoint.
2. WHEN the mutation succeeds, THE IdeGsmClient SHALL return the `taskId` string from the response.
3. IF the HTTP request fails or the response contains a GraphQL error, THEN THE IdeGsmClient SHALL throw an error with a descriptive message.

---

### 要件 5: exportProject mutation の呼び出し

**ユーザーストーリー:** 開発者として、プロジェクトを IDE-GSM からエクスポートしたい。そうすることで、成果物ファイルを取得できる。

#### 受け入れ基準

1. WHEN `exportProject` is called with a `projectRelativePath` string, THE IdeGsmClient SHALL send an `ExportProject` GraphQL mutation to the endpoint.
2. WHEN `exportProject` is called with an `include` glob pattern array, THE IdeGsmClient SHALL include the `include` field in the mutation input.
3. WHEN `exportProject` is called with an `exclude` glob pattern array, THE IdeGsmClient SHALL include the `exclude` field in the mutation input.
4. WHEN `exportProject` is called without `include` or `exclude`, THE IdeGsmClient SHALL omit those fields from the mutation input so that IDE-GSM applies its default filter.
5. WHEN the mutation succeeds, THE IdeGsmClient SHALL return the `taskId` string from the response.
6. IF the HTTP request fails or the response contains a GraphQL error, THEN THE IdeGsmClient SHALL throw an error with a descriptive message.

---

### 要件 6: awaitTask による非同期タスク完了待機

**ユーザーストーリー:** 開発者として、mutation で開始したタスクの完了を待機したい。そうすることで、タスク結果を同期的に扱えるフローを構築できる。

#### 受け入れ基準

1. WHEN `awaitTask` is called with a `taskId` string, THE IdeGsmClient SHALL open a WebSocket connection and subscribe to `subscribeTaskOnFrontend` with the given `taskId`.
2. WHEN a subscription event with `status` equal to `FINISHED` is received, THE IdeGsmClient SHALL resolve with the `TaskResult` object and close the subscription.
3. WHEN a subscription event with `status` equal to `FAILED` is received, THEN THE IdeGsmClient SHALL throw an error containing the `taskId` and status.
4. WHEN a subscription event with `status` equal to `CANCELED` is received, THEN THE IdeGsmClient SHALL throw an error containing the `taskId` and status.
5. IF the WebSocket connection cannot be established, THEN THE IdeGsmClient SHALL throw an error with a descriptive message.
6. FOR ALL valid `taskId` values, the `id` field in the received `TaskResult` SHALL equal the `taskId` passed to `awaitTask` (round-trip identity property).

---

### 要件 7: 接続失敗時のエラー処理

**ユーザーストーリー:** 開発者として、IDE-GSM への接続が失敗した場合に明確なエラーを受け取りたい。そうすることで、問題を迅速に診断できる。

#### 受け入れ基準

1. IF the HTTP connection to the GraphQL endpoint fails (e.g., network error, DNS resolution failure), THEN THE IdeGsmClient SHALL throw an error with a message that includes the `endpointUrl`.
2. IF the server returns an HTTP status code outside the 2xx range, THEN THE IdeGsmClient SHALL throw an error that includes the status code and response body.
3. IF the WebSocket connection is closed unexpectedly before a terminal `TaskStatus` is received, THEN THE IdeGsmClient SHALL throw an error with a descriptive message.
