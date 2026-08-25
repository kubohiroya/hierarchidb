# Staged Folder Action CLI Logging and Error Contract

## 目的

本書は、staged folder action CLI のログ出力、JSON 出力、exit code、typed error category/code の契約を定義する。

CLI は existing TreeConsole / Worker / IndexedDB / session manager / Map UI を外部入力から起動する。stderr log と stdout JSON は progress の mirror/result であり、progress SSOT ではない。progress SSOT は Worker / IndexedDB に記録される。

## 出力ストリーム

| Stream | 用途 | 制約 |
| --- | --- | --- |
| stdout | `--json` 指定時の単一 JSON result | progress log、browser console log、人間向け文言を混ぜない |
| stderr | 人間向け progress summary、diagnostic、non-JSON error summary | JSON result を混ぜない |
| log file | 詳細ログ。stderr 内容、browser console/page error、progress snapshot を保存できる | progress SSOT にしない |

`--json` 指定時、stdout は成功時も失敗時も単一 JSON object とする。

## CLI Options

| Option | 必須 | 意味 |
| --- | --- | --- |
| `--source-node-id <id>` | yes | overlay/merge の元になる既存 node ID |
| `--config <path>` | yes | JSON/YAML 設定ファイル |
| `--output-parent-node-id <id>` | conditional | `staging.mode: permanent-copy` のときだけ必須 |
| `--browser <mode>` | no | `headless | headed`。`map-image-capture` action でだけ使う |
| `--profile <profileName>` | no | 省略時は default profile。指定時は named profile |
| `--format <format>` | no | `json | yaml`。省略時は config path extension から推定する |
| `--json` | no | stdout に single JSON result object を出す |
| `--dry-run` | no | manifest と CLI options を検証し、実行計画を返す。指定しない場合は execution host が必要 |
| `--log-level <level>` | no | `silent | error | warn | info | debug` |
| `--log-file <path>` | no | 詳細ログ保存先 |

`staging.mode: patch-source` のような破壊的操作では、実装は追加 CLI option 例 `--allow-in-place` を要求してよい。要求する場合、省略時は `cli` category の typed error として失敗する。

現在の CLI contract では、`@hierarchidb/staged-folder-action` の `runStagedFolderActionCli()` が optional execution host injection を受け付ける。`--dry-run` なしの実行は、manifest / CLI option validation 後に注入済み host へ normalized input を渡す。host は実 profile の Worker / IndexedDB / browser host 接続、progress SSOT 更新、runner 起動、result 生成を担当する。host は成功 result または typed failure result を返し、throw する場合は `StagedFolderActionCliHostError` で typed failure result を保持する。これにより build/action/profile 等の category と run/action/build context を CLI JSON と exit code に保持する。bundled entrypoint `hdb-staged-folder-action` は `HDB_STAGED_FOLDER_ACTION_CLI_HOST_MODULE` で指定された host module を読み込み、未指定、import 失敗、invalid module は `profile` category の typed failure として fail-fast する。

WorkerAPI の `runStagedFolderAction(input)` は、同一 application profile 内の Worker execution host として実装されている。この host は staging/overlay/build/cleanup を実行し progress SSOT に記録する。CLI process から任意の既存 browser profile IndexedDB を直接共有する方式は保証範囲外であり、共有表示を行う場合は別 Issue で state sharing を定義する。

Phase 2 child #1598 で、CLI core と WorkerAPI execution host の間に `createStagedFolderActionCliExecutionHost()` adapter を追加済みである。adapter は CLI normalized input から `runId` を生成し、`sourceNodeId`、`outputParentNodeId`、`browserMode`、`config` を WorkerAPI-compatible runner input へ渡す。runner が返す `StagedFolderActionRunRecord` は CLI success JSON へ写像し、`warnings`、`pendingReferences`、`dependencyChanges` を保持する。runner が failure を throw した場合は、progress record の `phase`、`currentAction`、`buildSession` context に基づいて typed CLI failure result に変換し、`getRun(runId)` が利用できる場合は `stagingRootNodeId`、`buildQueueId`、`currentAction` context を保持する。app 側は `createStagedFolderActionCliWorkerExecutionHost()` で WorkerAPI `runStagedFolderAction(input)` をこの adapter に接続する。

child #1598 の bundled bin は host loader entrypoint を使う。`HDB_STAGED_FOLDER_ACTION_CLI_HOST_MODULE` が指定された場合、その module が export する execution host factory を使って non-dry-run を実行する。値が `./` / `../` で始まる相対パス、または絶対パスの場合は、実行時の `process.cwd()` 基準で `file://` URL に正規化して import する。package specifier と `file://` URL は Node ESM specifier としてそのまま import する。未指定、import 失敗、または invalid module の場合は `profile` category の typed failure とし、CLI core の host 未注入エラーへ落とさない。

child #1598 は Node process から既存 browser profile IndexedDB を共有する方式を定義しない。`map-image-capture` action が browser host 未注入で失敗した場合、adapter は成功扱いせず `map-image-capture` category の typed failure とする。browser host の標準注入は Phase 3 child #1606 で固定済みである。

Phase 3 child #1605 で、bundled CLI entrypoint、`HDB_STAGED_FOLDER_ACTION_CLI_HOST_MODULE` loader、CLI execution host adapter、WorkerAPI-compatible runner input、progress-derived failure context、stdout/stderr 分離を representative non-dry-run E2E として固定済みである。`--json` 指定時の stdout は success/failure とも single JSON object のみであり、human-readable progress summary は stderr/log に限定する。#1605 は任意の既存 browser profile IndexedDB を Node process から直接共有する方式を追加しないため、profile をまたぐ progress 共有は引き続き別仕様の範囲である。

Phase 3 child #1606 で、`--browser headless|headed` を CLI Worker bridge から app Worker execution host へ渡し、host 側の `runMapImageCaptureAction` injection に標準 browser capture runner を接続済みである。CLI success JSON は従来どおり manifest 上の action result (`outputPath`、`width`、`height`) を返し、screenshot 実書き込み path は browser host boundary で `outputBasePath` 基準の絶対 path に解決する。host boundary は manifest validation を信用しきらず、絶対 path、NUL、空 segment、`.` segment、`..` segment を screenshot 前に拒否する。browser host 実装は Node 専用 subpath から供給し、Playwright 型/API は CLI result schema、manifest schema、WorkerAPI-compatible runner input に含めない。

Phase 2 child #1600 の browser host factory は Node 専用 subpath `@hierarchidb/staged-folder-action/map-image-capture-browser-host` から import し、`baseUrl`、`routeMode`、`timeoutMs`、`outputBasePath`、browser launcher を明示的に受け取る。相対 `map-image-capture.output.path` は `outputBasePath` 基準で絶対 path に解決して screenshot write に使う。`headless` / `headed` は launcher の visibility option にだけ反映し、どちらも通常 Map route と同一 readiness contract を使う。render readiness error、blank canvas、page error、unhandled rejection、WebGL context loss、invalid browser host configuration は成功扱いせず、`map-image-capture` または host setup failure の typed failure として CLI result に反映する。capture failure 後の browser close failure は本来の capture failure を上書きせず、追加 context として扱う。CLI success JSON は completed run の `map-image-capture` action から `outputPath`、`width`、`height` を含む action result を出す。

Phase 2 child #1602 の export file host factory は Node 専用 subpath `@hierarchidb/staged-folder-action/export-file-host` から import し、`outputBasePath`、Step2 adapter 由来の row/column materializer、file writer、optional XLSX writer を明示的に受け取る。相対 `export-csv.output.path` / `export-xlsx.output.path` は `outputBasePath` 基準で絶対 path に解決して writer に渡す。host 境界でも絶対 path、NUL、空 segment、`.` segment、`..` segment は拒否する。CSV/XLSX row cell は string、finite number、boolean、null、undefined のみを受け付け、object/array/NaN/Infinity は成功扱いしない。CLI success JSON は runner record の `actionResults` に保存された `export-csv` / `export-xlsx` typed result をそのまま返す。export host 未設定、writer 未設定、invalid row、invalid output path、action/result mismatch は `export-csv` または `export-xlsx` category の typed failure として返す。

Phase 3 child #1607 の location / route export adapters は canonical column order を plugin 側の定数として固定し、shared export host に row/column materialization result として渡す。CLI / Node host は source path 解決、common effective data resolver、plugin feature store reader、file writer を明示 port として合成する。adapter は effective staged data resolver を通らない raw copy-on-write payload を使用してはならず、列順を row key から推測してはならない。invalid source path、unsupported requested column、object/array/NaN/Infinity cell、route `metadata.oneway` の non-boolean 値、Node writer 未設定は `export-csv` / `export-xlsx` の typed failure として返す。

Phase 3 child #1612 で、CLI dry-run、injected non-dry-run、typed writer failure、dependency contract violation の representative JSON を `packages/staged-folder-action/src/__tests__/fixtures/` に固定済みである。fixture test は実 browser、実 browser profile、実 output filesystem writer へ接続せず、CLI core、host adapter、typed error mapping の contract だけを検証する。これにより package-scoped CI は flakiness を増やさず、stdout の single JSON object、exit code、action result、failure category/code の回帰を検出する。writer failure は `export-csv` / `export-xlsx` category、dependency contract violation は `dependency` category とし、warning や reference failure へ丸めてはならない。

Phase 4 child #1639 で、staged-folder-action の CI coverage は package-scoped Vitest を基準に校正する。`@hierarchidb/staged-folder-action` 配下の実装差分は CI Validation の affected mode で `typecheck` と `test` を走らせる。docs-only PR / push は workflow の `paths-ignore` により通常は CI Validation の起動対象外であり、workflow が評価される場合は resolver の skip mode とする。workflow / root script / `turbo.json` 等の repository-wide input 差分は full validation とする。`pnpm run ci:validate:affected` は Turbo の `[base...head]` filter を使うため、staged-folder-action 実装変更では同 package と依存 build だけを fanout し、docs-only PR に root-level E2E を広げてはならない。

`@hierarchidb/staged-folder-action` の package-scoped tests は次の目的と runtime class を持つ。runtime class は CI の安定性判断に使う分類であり、`fast` は pure unit / mocked port、`fixture` は checked-in fixture I/O、`workflow-smoke` は実 process entrypoint と in-memory host を通す representative flow を表す。いずれも実 browser profile、実 Map UI server、外部 network、任意の既存 IndexedDB には接続しない。

| Test file | Purpose | Runtime class |
| --- | --- | --- |
| `cli.test.ts` | CLI option/manifest validation、stdout JSON、injected host result/failure/exit-code mapping | `fast` |
| `cliFixtures.test.ts` | representative dry-run / non-dry-run / writer failure / dependency violation fixture JSON の固定 | `fixture` |
| `createStagedFolderActionCliExecutionHost.test.ts` | bundled host module loader、WorkerAPI adapter mapping、typed failure metadata、production-like non-dry workflow smoke | `workflow-smoke` |
| `parseStagedFolderActionManifest.test.ts` | manifest schema、action registry、CLI option combination、unsafe path validation | `fast` |
| `createExportFileActionRunner.test.ts` | CSV/XLSX writer ports、canonical columns、safe output path、invalid cell/column failures | `fast` |
| `createMapImageCaptureBrowserActionRunner.test.ts` | browser runner composition、safe screenshot output path、browser close/failure preservation、Playwright launcher validation | `fast` |
| `mapImageCaptureBrowserHandoff.test.ts` | Map route URL、page port readiness, timeout, blank-canvas, screenshot handoff contract | `fast` |
| `mapImageCaptureIntent.test.ts` | IndexedDB state-channel intent shape and viewport validation | `fast` |
| `stagedFolderActionProgress.test.ts` | progress record phase shape and strict progress percentage validation | `fast` |

Phase 4 browser/file workflow tests must declare their scope through injected ports and checked-in fixtures rather than ambient resources. Browser workflow tests use Playwright-like page/browser mocks, an explicit `timeoutMs` value, and deterministic readiness/blank-canvas/page-error branches. File workflow tests use an explicit `outputBasePath`, writer/materializer ports, and checked-in JSON manifests/expected results where fixture output is part of the contract. Flake controls are contractual fail-fast checks: invalid timeout, unsafe path, missing host/writer, readiness timeout, blank canvas, and typed dependency/reference failures must fail as typed errors instead of being quarantined or silently downgraded.

CLI/result mapping and injected port failure coverage stays package-scoped where feasible. Adding a Phase 4 action must first add or extend the relevant package-scoped runner/adapter/fixture tests; broader root E2E is reserved for app integration surfaces that cannot be represented by injected ports. If a test genuinely requires an app server or real browser profile, the PR must document why package-scoped coverage is insufficient and must give an explicit timeout and fixture boundary in the corresponding issue.

## 成功 JSON

```typescript
type StagedFolderActionCliSuccessResult = {
  ok: true;
  version: 1;
  runId: string;
  sourceNodeId: string;
  outputParentNodeId?: string;
  stagingMode: 'temporary-copy' | 'permanent-copy' | 'patch-source';
  actions: string[];
  browserMode?: 'headless' | 'headed';
  profileName: string;
  stagingRootNodeId?: string;
  buildQueueId?: string;
  actionResults: Array<
    | {
        type: 'build';
        status: 'completed';
        buildQueueId: string;
      }
    | {
        type: 'map-image-capture';
        status: 'completed';
        outputPath: string;
        width: number;
        height: number;
      }
    | {
        type: 'export-csv';
        status: 'completed';
        outputPath: string;
        entityType: 'location' | 'route';
        rowCount: number;
      }
    | {
        type: 'export-xlsx';
        status: 'completed';
        outputPath: string;
        entityType: 'location' | 'route';
        rowCount: number;
        sheetName: string;
      }
    | {
        type: 'export-archive';
        status: 'completed';
        outputPath: string;
      }
    | {
        type: 'import-mount';
        status: 'completed';
        mountId: string;
        mountedRootNodeId: string;
        lifetime: 'run' | 'retain' | 'permanent';
      }
    | {
        type: string;
        status: 'completed';
        artifacts?: Array<{
          kind: string;
          path?: string;
          nodeId?: string;
          id?: string;
        }>;
        metrics?: Record<string, number>;
      }
  >;
  cleanup: {
    policy: 'retain' | 'delete-on-success' | 'delete-always';
    status: 'not-run' | 'retained' | 'deleted' | 'failed';
    error?: string;
  };
  warnings: Array<{
    category: 'reference';
    code: string;
    message: string;
    nodeId?: string;
    dependentNodeId?: string;
    referencePath?: string;
    expectedTargetType?: string;
    actualTargetType?: string;
    actionIndex?: number;
    actionType?: string;
    mountId?: string;
    pluginId?: string;
  }>;
  pendingReferences: Array<{
    status: 'pending' | 'resolved';
    code: string;
    nodeId?: string;
    dependentNodeId?: string;
    referencePath: string;
    expectedTargetType?: string;
    resolvedTargetNodeId?: string;
    actionIndex?: number;
    actionType?: string;
    mountId?: string;
    pluginId?: string;
  }>;
  dependencyChanges: Array<{
    edgeId: string;
    previousStatus: 'active' | 'stale' | 'rebuilding' | 'resolved' | 'orphaned';
    nextStatus: 'active' | 'stale' | 'rebuilding' | 'resolved' | 'orphaned';
    artifactId?: string;
    buildTargetId?: string;
    sourceNodeId?: string;
    targetNodeId?: string;
    targetFieldPath?: string;
    rebuildPlanId?: string;
  }>;
  elapsedMs: number;
};
```

`actions: []` の場合、`actionResults` は空 array である。地図画像出力結果は `map-image-capture` action result にだけ含める。後続 action は registry で定義した typed result を返す。generic result は bridge であり、action 固有 result schema が定義されたらそちらを優先する。

遅延解決される reference の未解決は `pendingReferences` に記録し、ユーザー向け表示として `warnings` にも反映できる。後続 import/mount/overlay で解決されたものは `status: 'resolved'` とし、解決先が node の場合は `resolvedTargetNodeId` を記録する。dependency 未解決、artifact dependency lifecycle violation、contract violation は warning にしてはならない。

Phase 2 child #1596 で、CLI は injected execution host が返した `warnings`、`pendingReferences`、`dependencyChanges` を成功 JSON にそのまま保持する contract を固定済みである。空配列でない pending/resolved reference entry を CLI 側で落としたり、`warnings` だけに畳み込んだりしてはならない。typed failure result の `dependency` / `reference` category には dependent node、reference path、expected/actual target、mount/plugin context を含められる。

Phase 2 child #1598 の WorkerAPI adapter は runner record が保持する `warnings`、`pendingReferences`、`dependencyChanges` を CLI success JSON に引き継ぐ。adapter は dependency change を推測生成してはならない。

artifact dependency edge の状態変化は `dependencyChanges` に記録する。元データ変更により artifact を `stale` にした場合、または incremental rebuild を `rebuilding` として予約した場合、CLI result から追跡できなければならない。

Phase 4 child #1636 では、runner record の `failure` が `dependency` / `reference` metadata（`nodeId`、`dependentNodeId`、`referencePath`、`expectedTargetType`、`actualTargetType`、`mountId`、`pluginId`）を持つ場合、CLI adapter はその metadata を失敗 JSON の `error` に保持する。CLI adapter は dependency / reference failure を error message substring で分類してはならず、runner record の typed `failure.category` / `failure.code` / metadata を優先する。

## 失敗 JSON

```typescript
type StagedFolderActionCliErrorResult = {
  ok: false;
  version: 1;
  dryRun?: false;
  runId?: string;
  sourceNodeId?: string;
  nodeId?: string;
  stagingRootNodeId?: string;
  buildQueueId?: string;
  actionIndex?: number;
  actionType?: string;
  error: {
    category: StagedFolderActionCliErrorCategory;
    code: string;
    message: string;
    path?: string;
    nodeId?: string;
    dependentNodeId?: string;
    referencePath?: string;
    expectedTargetType?: string;
    actualTargetType?: string;
    sourceNodeId?: string;
    outputParentNodeId?: string;
    stagingRootNodeId?: string;
    buildQueueId?: string;
    actionIndex?: number;
    actionType?: string;
    mountId?: string;
    pluginId?: string;
    cause?: string;
  };
};
```

`message` は人間が読める短い説明とするが、制御分岐は `category` と `code` を使う。

## Error Categories

| Category | 例 |
| --- | --- |
| `cli` | option 不正、引数不足、破壊的操作許可不足 |
| `manifest` | parse error、schema violation、unsafe output path、不正 bbox |
| `profile` | browser profile 作成失敗、profile lock、Worker 接続失敗 |
| `source` | source node 不在、source type 不正、copy 対象不整合 |
| `staging` | staging root 作成失敗、名前衝突、copy/import 失敗 |
| `overlay` | target path 不在、data merge violation、重複 patch |
| `reference` | unresolved lazy reference、unresolved route location warning、unresolved shape centroid warning |
| `dependency` | hard dependency missing、type mismatch、unresolved relation participant、artifact dependency lifecycle violation、stale artifact without rebuild plan |
| `build` | build queue 作成失敗、canonical build failure、auth-required timeout、paused |
| `action` | registry prerequisite violation、unknown action runtime failure |
| `export-archive` | export source 解決失敗、canonical export failure、archive write failure |
| `export-csv` | export host 未設定、row materialization failure、invalid row/cell、CSV write failure |
| `export-xlsx` | export host 未設定、XLSX writer 未設定、invalid row/cell、XLSX write failure |
| `import-mount` | archive validation failure、mount path conflict、participant compatibility failure、safe unmount failure |
| `map-image-capture` | Map UI 起動失敗、layer 解決失敗、MapLibre idle timeout、canvas blank |
| `simulation-run` | simulation engine failure、invalid simulation input、result persistence failure |
| `map-pdf-render` | PDF render failure、page layout violation、PDF write failure |
| `map-print` | print dialog/print job failure、printer profile violation |
| `folder-diagnostics` | hierarchy traversal failure、diagnostic rule failure |
| `backup-export` | backup archive creation failure、export participant failure |
| `output` | artifact 保存失敗、path conflict、write permission error |
| `cleanup` | staging cleanup failure |
| `progress` | Worker / IndexedDB progress record 欠落、progress update failure |
| `internal` | unexpected internal error |

## Exit Codes

| Exit code | 意味 |
| --- | --- |
| `0` | 要求された範囲が成功 |
| `1` | CLI option / manifest validation / contract violation |
| `2` | profile / Worker / browser startup failure |
| `3` | source / staging / overlay failure |
| `4` | build failure / paused / auth-required timeout |
| `5` | reference / dependency / action failure other than build |
| `6` | output/artifact write failure |
| `7` | cleanup failure after otherwise successful output |
| `70` | unexpected internal error |

cleanup failure は独立 exit code を持つ。action output が成功していても、`staging.cleanup` が要求した cleanup に失敗した場合は exit code `7` とする。

## Progress Handling

CLI は以下を Worker / IndexedDB progress API に報告する。

- config validation start / success / failure
- staging preparation start / success / failure
- overlay application start / success / failure
- pending reference resolution start / success / warning / failure
- dependency resolution failure。unresolved hard dependency は warning へ変換しない
- action start / success / failure
- export-archive start / success / failure
- import-mount start / success / failure
- safe unmount start / success / failure
- build queue creation and build terminal status
- map-image-capture start / success / failure
- action-specific phase start / success / failure
- output/artifact write start / success / failure
- cleanup start / success / failure

stderr はこの progress の human-readable mirror である。CLI が独自 counter、固定 sleep、推測 stage によって progress を作ってはならない。

## Browser / Map UI Error Handling

`map-image-capture` action は existing Map UI を使う。`--browser headless` でも `--browser headed` でも、新規 tab で通常 Map UI を開く。headless mode でも専用 route を使わない。

- `console.error`、page error、unhandled rejection は typed error へ昇格する。
- `console.warn` は既定では log file に記録するが、成功/失敗判定は allowlist policy に従う。
- WebGL context loss、MapLibre idle timeout、blank canvas は成功扱いにしない。
- requested layer が解決できない場合、partial screenshot を成功扱いにしない。

## 契約違反の扱い

- 必須値欠落、不正 path、不正 bbox、merge target 不在は fail-fast。
- default 補完、clamp、名前自動 suffix、似た path 推測で継続しない。
- stdout JSON の `category` / `code` / `path` / `nodeId` が診断入口として十分でなければならない。
- progress update に失敗したまま処理を成功扱いにしてはならない。

## Rollback

本仕様のみの rollback は本ファイルの revert で完了する。実装では CLI command を未公開または feature flag 下に置き、既存 UI / Worker / Map UI の通常操作に影響しないようにする。
