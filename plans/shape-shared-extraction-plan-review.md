# shape-shared-extraction ExecPlan 精査と行数倍増の作業計画

本書は `plans/shape-shared-extraction-stage*.md` を対象に、設計上の見落とし/矛盾点を整理し、各ファイルの行数を「倍」にすることを定量基準として増補するための作業計画である。ここでの「行数」は `wc -l` の結果（空行含む）に従う。

## 対象ファイルと行数基準

- `plans/shape-shared-extraction-stage1-runtime-worker.md`: 現在 97 行 → 目標 194 行
- `plans/shape-shared-extraction-stage2-download-registry.md`: 現在 96 行 → 目標 192 行
- `plans/shape-shared-extraction-stage3-tabular-api.md`: 現在 93 行 → 目標 186 行
- `plans/shape-shared-extraction-stage4-progress-hooks.md`: 現在 91 行 → 目標 182 行
- `plans/shape-shared-extraction-stage5-batch-session-manager.md`: 現在 95 行 → 目標 190 行

行数倍増は「内容の追加で達成する」ことを前提とし、空行のみの増加や無意味な繰り返しは行わない。増補は PLANS.md の要件（自己完結、用語定義、検証可能性、成果の観測方法）を満たす方向で行う。

## 精査結果（見落とし/矛盾/不適切点）

### Stage 1: Runtime Worker Adapter

- 既存の flag 名が shape 側に存在しない。location/route は `LOCATION_RUNTIME_WORKER` / `ROUTE_RUNTIME_WORKER` だが、shape には同等フラグがなく導入方針が未確定。
- `packages/runtime-worker` に `readRuntimeEnvValue` を導入する場合の依存追加が未記載。実装には `@hierarchidb/util` 依存が必要になる可能性がある。
- 動的 import の実装差が未整理（shape は `createStageWorkerClient` を直接使用、location/route は `@hierarchidb/runtime-worker-worker` を動的 import）。統一後の優先順や失敗時の挙動が未定義。

### Stage 2: Download Registry

- shape の download helper は `getCorsProxyBaseURL` / `resolveNetworkUrl` を併用し、キャッシュされた `DownloadServiceBundle` を持つ。新しい registry によるキャッシュ戦略の明示が不足。
- location/route の registry は auth notifier fallback をグローバルに解決するが、shape は `AuthRecoveryService` に直接依存する。統一後にどの auth 通知経路を優先するか明記されていない。
- `plugins/location-plugin/src/services/utils/authFetch.ts` の `pluginType` が `shape` 固定である不具合の修正は述べているが、整合する pluginType の定義位置（共通 enum か string）を示していない。

### Stage 3: Tabular API

- `packages/plugin-ui-sdk` へ移設すると `@hierarchidb/spreadsheet-plugin` 依存が生じ、パッケージがプラグインへ依存する逆転が起きる可能性が高い。依存方向の制約が未整理。
- 代替案（tabular factory を plugins 側に残し共通 util だけ packages に置く、あるいは SpreadsheetTabularApiDriver を packages へ移管）を提示していない。
- CORS proxy 変換の責務境界が曖昧で、download registry（Stage 2）との責務重複が起こる可能性がある。

### Stage 4: Progress Hooks

- route は `@hierarchidb/batch-runtime-services` の hook を使っており、shape/location は `@hierarchidb/batch` を利用している。単一の UI hook に統一する際の依存調整が未明記。
- location は `AuthNotificationRegistry` 連携により progress を上書きする独自挙動がある。共有 hook による保持方法の具体化が不足。
- route は pause/resume を hook 内で提供しており、shared hook に統合するか、別 hook に分離するかの方針が未決。

### Stage 5: Batch Session Manager

- `BaseBatchSessionManager` は `packages/batch-runtime-services` の `AbstractBatchSession` を前提にしているが、shape/location は `@hierarchidb/batch` の `AbstractBatchSession` を使用している。ここに互換性の断絶がある。
- route の `RouteBatchSession` は既に `batch-runtime-services` を利用しており、shape/location を揃える場合に利用パッケージの統合が必要になる。
- shape の Dexie 永続化と location の ephemeral DB を共通 base にどう組み込むか（hook 位置、タイミング）が未記載。

## 行数倍増のための増補方針

倍増のために、各 ExecPlan の以下の章を具体的に増補する。各項目で追加する内容は、単なる冗長化ではなく「手戻り防止」「新人でも実装可能」「検証結果の観測手段」を明確にする方向で増やす。

1) Purpose / Big Picture
   - ユーザー視点の観測可能な成果と、その確認手順を追記する。
2) Context and Orientation
   - 対象ファイル/クラス/関数の役割を 1 段掘り下げ、コード依存関係を明記する。
3) Plan of Work / Concrete Steps
   - 既存挙動との差分と移行順序（危険箇所、先行移設、後続更新）を具体化する。
   - 依存変更（package.json、tsconfig、exports）を明記する。
4) Validation and Acceptance
   - 「成功の観測方法」を追加し、具体的なログや UI 変化の確認を記述する。
5) Idempotence and Recovery
   - リスク別のロールバック（設定のみ/コードのみ/データのみ）を分類して記載する。
6) Interfaces and Dependencies
   - 主要関数の型シグネチャ例や入力/出力の定義を追加する。

## 各ファイルの増補計画（行数目標に合わせた配分）

### Stage 1（97 → 194）: 追加目標 +97 行

- 追加セクション案: 「Flag 管理の方針」「動的 import の優先順」「依存追加の影響」
- 具体的な追加内容:
  - shape 用 flag の新設/既存利用の比較と決定基準
  - `readRuntimeEnvValue` 追加時の runtime-worker 依存変更
  - `@hierarchidb/runtime-worker-worker` が未導入時の明確な挙動
  - `registerRuntimeWorkerClient` の呼び出しタイミング（app 起動/プラグイン初期化）

### Stage 2（96 → 192）: 追加目標 +96 行

- 追加セクション案: 「DownloadService キャッシュ戦略」「Auth 通知統一」「CORS 変換と registry の責務分離」
- 具体的な追加内容:
  - service のキャッシュ（プロセス単位/DB prefix 単位）
  - auth notifier の解決順序（registry > AuthNotificationRegistry > legacy global）
  - `downloadJson` の retry パラメータとデフォルト値の明記
  - `resolveNetworkUrl` と CORS proxy の関係整理

### Stage 3（93 → 186）: 追加目標 +93 行

- 追加セクション案: 「依存方向の制約」「移設代替案」「移設後の import 層」
- 具体的な追加内容:
  - packages が plugins に依存できない前提の明記
  - 代替案 A: driver を packages へ移動
  - 代替案 B: shared util は packages、factory は plugins に残す
  - 移設時の export 更新と tsdown build への影響

### Stage 4（91 → 182）: 追加目標 +91 行

- 追加セクション案: 「Auth override 連携」「pause/resume API の扱い」「依存パッケージ統一」
- 具体的な追加内容:
  - AuthNotificationRegistry の hook を共有 hook が受け取る設計
  - pause/resume を `useBatchControl` として分離する案
  - `@hierarchidb/batch` と `@hierarchidb/batch-runtime-services` の統一方針

### Stage 5（95 → 190）: 追加目標 +95 行

- 追加セクション案: 「AbstractBatchSession の統一」「DB 永続化フック」「セッションID互換」
- 具体的な追加内容:
  - shape/location が `@hierarchidb/batch-runtime-services` へ移行する条件
  - `BaseBatchSessionManager` の `emitProgress` 連携時の型要件
  - Dexie 更新と session lifecycle の順序（start/complete/cancel）
  - route の orchestrator を保持する場合の設計図

## 作業手順（倍増までの実行計画）

1) 事前計測: `wc -l plans/shape-shared-extraction-stage*.md` を実行し、基準値をログ化する。
2) 各Stageに対し、上記の増補セクションを追加し、必ず PLANS.md の自己完結性に反しない説明を補う。
3) 各ファイルの増補後に `wc -l` を再計測し、目標行数に到達するまで内容を追加する。
4) 追加した内容が単なる冗長化になっていないかを再点検し、同義の重複文があれば削除して他の未充足説明を追加する。
5) 5ファイル全てが目標行数に達したことを記録し、TASKS の運用ログに done を追記する。

## 検証計画

- 検証は行数の定量確認に限定し、`wc -l` の結果を記録する。
- 実装検証（typecheck / test）は本作業の範囲外とし、必要に応じて後続タスクで実施する。

## ロールバック方針

- 本作業はドキュメント更新のみであるため、ロールバックは `plans/shape-shared-extraction-stage*.md` の変更差分と本書の削除で完了する。
- TASKS の運用ログ追記と Done 記載も同時に元へ戻す。
