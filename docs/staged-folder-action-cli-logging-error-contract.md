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

Phase 1 初期 CLI contract では、`@hierarchidb/staged-folder-action` の `runStagedFolderActionCli()` が optional execution host injection を受け付ける。`--dry-run` なしの実行は、manifest / CLI option validation 後に注入済み host へ normalized input を渡す。host は実 profile の Worker / IndexedDB / browser host 接続、progress SSOT 更新、runner 起動、result 生成を担当する。host は成功 result または typed failure result を返し、throw する場合は `StagedFolderActionCliHostError` で typed failure result を保持する。これにより build/action/profile 等の category と run/action/build context を CLI JSON と exit code に保持する。bundled entrypoint `hdb-staged-folder-action` はまだ host を注入しないため、`--dry-run` なしで実行を要求した場合は `cli` category / `STAGED_FOLDER_ACTION_CLI_EXECUTION_HOST_NOT_CONFIGURED` として fail-fast する。

Phase 0 では CLI bridge とは別に、WorkerAPI の `runStagedFolderAction(input)` が同一 application profile 内の Worker execution host として実装されている。この host は staging/overlay/build/cleanup を実行し progress SSOT に記録するが、CLI process から profile/Worker/browser を起動して接続する責務はまだ持たない。

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

Phase 2 child #1596 では、CLI は injected execution host が返した `warnings`、`pendingReferences`、`dependencyChanges` を成功 JSON にそのまま保持する。空配列でない pending/resolved reference entry を CLI 側で落としたり、`warnings` だけに畳み込んだりしてはならない。typed failure result の `dependency` / `reference` category には dependent node、reference path、expected/actual target、mount/plugin context を含められる。

artifact dependency edge の状態変化は `dependencyChanges` に記録する。元データ変更により artifact を `stale` にした場合、または incremental rebuild を `rebuilding` として予約した場合、CLI result から追跡できなければならない。

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
