# Staged Folder Action Specification

## 目的

本書は、JSON/YAML 設定を CLI から与え、既存 folder/node を元に patched folder hierarchy を staging し、その staging hierarchy に対して一連の action を自動実行する仕組みの正規仕様を定義する。

特定の視野・サイズで地図画像を作成する機能は、この仕組みの具体 action の一つである。本機能は専用 route や CLI 専用 build 実装を作らない。既存の TreeConsole、folder build queue、AppBar の session manager、canonical build session、Worker、IndexedDB/Dexie、Map UI を使う。CLI はそれらを外部入力から起動し、観測し、action 結果を出力する入口である。

既存 export/import は、folder/node hierarchy とそれに付随する Dexie/IndexedDB 永続データを外部ファイルへ静的に materialize し、後で import によって同等の状態を再構成する static action であった。staged-folder-action は、その処理単位を引き継ぎ、staging / overlay / action sequence / cleanup という時間軸を持つ dynamic action へ拡張する。したがって既存 export/import は staged-folder-action の外側にある特別機能ではなく、action registry に登録可能な action として扱う。

## 基本方針

- CLI は source node、JSON/YAML config path を必ず受け取り、permanent copy のときだけ output parent node を追加で受け取る。
- JSON/YAML は、staging、overlay、action sequence、cleanup の設定を表す。
- 入力元は既存フォルダまたは既存ノードである。ただし初期実装では folder source を主対象とし、単一ノード source は後続拡張として扱ってよい。
- staging folder/node は通常 TreeConsole 上に作成される。
- `build` action は既存 folder build queue と session manager で管理する。
- progress state は Worker / IndexedDB 管理を正とし、localStorage を SSOT にしない。
- CLI stderr/stdout は progress の mirror/result であり、進捗 SSOT ではない。
- 契約違反は fail-fast とし、暗黙 default、clamp、fallback merge で処理を継続しない。

## CLI Invocation Contract

CLI は少なくとも以下を受け取る。

```bash
hdb-staged-folder-action \
  --source-node-id <node-id-to-copy-or-patch> \
  --config <path-to-json-or-yaml> \
  [--output-parent-node-id <parent-folder-node-id-for-permanent-result>] \
  [--browser headless|headed] \
  [--profile <profileName>]
```

| Option | 必須 | 説明 |
| --- | --- | --- |
| `--source-node-id` | yes | overlay/merge の元になる既存 node ID。通常は folder node |
| `--config` | yes | JSON/YAML 設定ファイル |
| `--output-parent-node-id` | conditional | `staging.mode: permanent-copy` のときだけ必須。temporary copy では不要 |
| `--browser` | no | `headless` または `headed`。どちらも新規 tab で通常 Map UI を開く |
| `--profile` | no | 接続する browser/application profile 名。省略時は default profile |
| `--json` | no | 完了結果または失敗結果を stdout に single JSON で出す |
| `--log-level` | no | stderr/log file の詳細度 |
| `--log-file` | no | 詳細ログ出力先 |

`--source-node-id` は config file 内で暗黙探索しない。`--output-parent-node-id` は permanent copy の出力先を指定する引数であり、temporary copy では system-managed `temporary-folder` を使うため要求しない。

## Manifest Format

JSON と YAML は同じ正規構造を表す。

```typescript
type StagedFolderActionConfig = {
  version: 1;
  staging: {
    mode: 'temporary-copy' | 'permanent-copy' | 'patch-source';
    name?: string;
    cleanup: 'retain' | 'delete-on-success' | 'delete-always';
  };
  overlay: {
    nodes: Array<{
      match: {
        path: string;
      };
      data: Record<string, unknown>;
    }>;
  };
  actions: StagedFolderAction[];
};

type StagedFolderAction =
  | {
      type: 'build';
      mode: 'session-manager';
    }
  | {
      type: 'export-archive';
      format: 'canonical-yaml-zip';
      source: {
        path: string;
      };
      output: {
        path: string;
      };
    }
  | {
      type: 'export-csv';
      entityType: 'location' | 'route';
      source: {
        path: string;
      };
      output: {
        path: string;
      };
      columns?: string[];
      includeDependencyStatus?: boolean;
    }
  | {
      type: 'export-xlsx';
      entityType: 'location' | 'route';
      source: {
        path: string;
      };
      output: {
        path: string;
        sheetName?: string;
      };
      columns?: string[];
      includeDependencyStatus?: boolean;
    }
  | {
      type: 'import-mount';
      format: 'canonical-yaml-zip';
      input: {
        path: string;
      };
      mount: {
        parentPath: string;
        name: string;
        lifetime: 'run' | 'retain' | 'permanent';
      };
    }
  | {
      type: 'map-image-capture';
      mode: 'map-ui';
      output: {
        path: string;
        width: number;
        height: number;
      };
      viewport: {
        bbox: [west: number, south: number, east: number, north: number];
      };
      layers: Array<{
        path: string;
        visible: boolean;
      }>;
    };

type StagedFolderActionResult =
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
      type: 'import-mount';
      status: 'completed';
      mountId: string;
      mountedRootNodeId: string;
      lifetime: 'run' | 'retain' | 'permanent';
    };
```

TreeNode は本機能のために以下の optional property を持つ。

```typescript
type CopyOnWriteTreeNodeFields = {
  copyOnWriteOf?: string;
  patchData?: Record<string, unknown>;
};
```

`copyOnWriteOf` は参照元 node ID を指す。`patchData` は参照元 node の committed `data` に strict merge する差分である。これらが指定された node は、参照元 node の構造と data を読み、`patchData` を重ねた結果を build / Map UI / capture の入力として扱う。

YAML example:

```yaml
version: 1

staging:
  mode: temporary-copy
  name: tokyo-map-capture
  cleanup: retain

overlay:
  nodes:
    - match:
        path: routes/main
      data:
        buildConfig:
          routeGeneration:
            method: direct

actions:
  - type: build
    mode: session-manager
  - type: map-image-capture
    mode: map-ui
    output:
      path: exports/tokyo.png
      width: 1280
      height: 720
    viewport:
      bbox: [139.5, 35.5, 140.0, 36.0]
    layers:
      - path: routes/main
        visible: true
```

## Staging Contract

`staging.mode` は処理対象をどこに作るかを定義する。

| Mode | 説明 | 用途 |
| --- | --- | --- |
| `temporary-copy` | `--source-node-id` 配下を `temporary-folder` 配下へ copy-on-write node として作成し、overlay を `patchData` に反映する | デバッグ、CLI 試行、使い捨て画像生成。`--output-parent-node-id` は不要 |
| `permanent-copy` | `--source-node-id` 配下を `--output-parent-node-id` 配下へ copy-on-write node として作成し、overlay を `patchData` に反映する | ユーザーが結果 folder を TreeConsole 上に残したい場合。`--output-parent-node-id` は必須 |
| `patch-source` | `--source-node-id` が指す既存 node/folder に直接 overlay を適用する | 明示的な in-place 更新。破壊的なので追加許可を要求する |

`staging.name` は temporary/permanent copy の staging root 表示名であり、空文字は禁止する。`patch-source` では staging root を新規作成しないため `name` を使わない。名前衝突時は fail-fast する。自動 suffix 付与で継続してはならない。

`temporary-folder` は system-managed な特殊 holder folder node である。位置付けは既存の draft holder と同じ system holder 系列だが、draft holder そのものではない。通常の TreeConsole では不可視だが、temporary-copy の staging root が存在している間だけ、デバッグと session manager 連動のため可視化される。temporary-copy の親 folder はこの `temporary-folder` であり、ユーザーが `--output-parent-node-id` で指定しない。`temporary-folder` は tree ごとに存在し、temporary-copy は source node の ancestor chain から所属 tree を解決して同じ tree の holder 配下に staging root を作る。source node が既知 tree に接続されていない場合、default tree へ fallback せず contract violation とする。

`temporary-folder` と draft holder は lifecycle と data semantics を共有しない。

- draft holder は working copy、`draftData`、commit/discard のために使う。
- `temporary-folder` は staged folder action staging、`copyOnWriteOf`、`patchData`、cleanup のために使う。
- temporary-copy node は draft として扱ってはならない。
- draft commit/discard API は temporary-copy node を対象にしてはならない。
- `listDrafts()` のような draft enumeration は temporary-copy node を返してはならない。
- temporary cleanup は draft holder や draft state を削除してはならない。

Phase 0 の `temporary-folder` 実装は、system holder の作成、表示 lifecycle、draft API からの隔離、cleanup 境界、temporary-copy の copy-on-write subtree 作成を固定する。temporary-copy staging root とその子孫は、source subtree と同じ display hierarchy を持ち、各 copied node の `copyOnWriteOf` に参照元 node ID を保持する。copied node 自身の `data` に source の committed data を物理複製してはならない。overlay は copied node の `patchData` に蓄積され、effective data resolver により `copyOnWriteOf.data + patchData` として読まれる。

`staging.cleanup` は実行後の staging root の扱いを定義する。

| Cleanup | 説明 |
| --- | --- |
| `retain` | 成功/失敗に関係なく staging root を残す |
| `delete-on-success` | 成功時だけ staging root を削除し、失敗時は残す |
| `delete-always` | 成功/失敗に関係なく staging root 削除を試みる |

`cleanup` は staging root の寿命だけを制御する。progress record、build queue/session record、CLI result の保持可否を `cleanup: retain` に依存させてはならない。`delete-always` でも削除失敗は output/result と caller-visible error の両方に記録し、成功画像がある場合も cleanup failure を無視してはならない。

`patch-source` では新規 staging root を作らないため、cleanup 対象は存在しない。`patch-source` で `delete-on-success` または `delete-always` を指定した場合は contract violation とする。source node/folder を cleanup として削除してはならない。

## Recursive Copy / Import Contract

`staging.mode: temporary-copy` と `staging.mode: permanent-copy` は、source subtree と同じ表示構造を持つ copy-on-write node tree を作る。各 copied node は参照元 node ID を `copyOnWriteOf` に保持し、manifest overlay は copied node の `patchData` に反映する。

現在の実装前提:

- `CoreDB.duplicateSubtreeWithMap()` は source subtree の物理複製用であり、copy-on-write temporary-copy には使わない。temporary-copy は `temporary-folder` lifecycle service が CoW 専用 subtree を作成し、各 copied node の `data` を `null`、`copyOnWriteOf` を source node ID とする。
- 2025-11 以降、plugin payload は PeerStore ではなく `TreeNode.data/draftData` が SSOT である。
- folder-plugin の canonical YAML ZIP plan は `metadata.name + data` または `draftMetadata.name + draftData` を明示 slot で扱い、cross-slot fallback をしない。

初期仕様の copy 対象:

- tree node hierarchy
- node metadata
- `copyOnWriteOf`
- `patchData`

copy-on-write node の effective committed data は、参照元 node の committed `data` に copied node の `patchData` を strict merge した結果である。`patchData` は `copyOnWriteOf` を持つ node の属性であり、通常 node に単独で設定してはならない。copied node 自身の `data` に参照元 data を物理複製してはならない。ただし、後続で materialize operation を定義する場合は別仕様で扱う。

## Effective Data Resolver Contract

effective data の解決は共通 resolver を SSOT とする。build、Map UI、Preview feature table、TreeTable / node detail UI、CSV / XLSX export、reference/dependency resolver、overlay engine、CLI action runner、diagnostics、capture は、TreeNode の `data` / `draftData` / `copyOnWriteOf` / `patchData` / mount record / patch-source 状態をそれぞれ独自に条件分岐して読んではならない。

共通 resolver は少なくとも以下を提供する。

```typescript
type EffectiveDataSlot = 'committed' | 'draft' | 'effective-staged';

type EffectiveDataRequest = {
  nodeId: string;
  slot: EffectiveDataSlot;
  stagingRootNodeId?: string;
  includeMountedContent?: boolean;
};

type EffectiveDataResult = {
  nodeId: string;
  slot: EffectiveDataSlot;
  data: Record<string, unknown>;
  source: {
    baseNodeId: string;
    copyOnWriteOf?: string;
    patchDataApplied: boolean;
    draftDataApplied: boolean;
    mountedContentApplied: boolean;
  };
  version: {
    baseVersion?: number;
    draftVersion?: number;
    patchVersion?: number;
    mountVersion?: number;
  };
};
```

slot の意味:

| Slot | 意味 |
| --- | --- |
| `committed` | node の committed `data`。copy-on-write node では `copyOnWriteOf.data + patchData` を返す |
| `draft` | dialog / working copy が対象とする draft view。draftData が存在する場合は committed/effective base に draftData を重ねる |
| `effective-staged` | staged-folder-action が action input として読む view。copy-on-write、`patchData`、`import-mount`、`patch-source` の結果を反映する |

resolver は strict merge rules を `Overlay Contract` と共有する。object は再帰 merge、scalar と array は replace、未知の patch 操作は contract violation とする。resolver の利用者が独自 merge、fallback、default 補完、近似 node 探索、slot 間 fallback を実装してはならない。

Phase 0 の resolver 実装では、`effective-staged` は copy-on-write と `patchData` を反映する。`import-mount`、`patch-source` の action 実行結果、staging context の mount record 適用は後続 phase で resolver input に接続する。それまでは `mountedContentApplied: false` を返し、呼び出し側で独自に mount record を混ぜてはならない。

Phase 0 では `TreeQueryService` が `copyOnWriteOf` または `patchData` を持つ node を返す場合、共通 resolver を通して `data` を effective staged data に差し替える。これにより、既存 Map UI / capture が通常の `getNode` / `listChildren` / `listDescendants` 経路を使っても CoW overlay 後の値を読む。通常 node は resolver を通さず従来通り返す。`patchData` が `copyOnWriteOf` なしに存在する場合は contract violation として失敗させ、空 object や raw `data` への fallback は行わない。

resolver は `copyOnWriteOf` の参照先欠落、循環、`patchData` の不正 shape、`copyOnWriteOf` を持たない node への `patchData` 設定、draftData の不正 shape、mount record 不整合を typed error として返す。呼び出し側はこれらを握りつぶして空 object や元 node data に fallback してはならない。

CSV / XLSX export など、どの slot を出力するかがユーザー操作に依存する UI は、呼び出し前に `committed` / `draft` / `effective-staged` のいずれを使うかを明示する。未保存 draft を含めるかどうかを UI component 内の独自判定にしてはならない。

初期仕様で copy しない対象:

- active build session runtime
- transient task queue
- UI-only dialog state / draft state
- stale render/capture state
- build artifact/cache records
- plugin Group/Relation store records。ただし build 入力として必須な plugin は copy/import participant を明示実装する必要がある

この仕様上の具体的な未実装リスクは「TreeNode.data 以外の Group/Relation store を build 入力に持つ plugin が、idMap に基づく copy/import participant を持たない場合」である。その場合は copy 後に build 入力が欠落するため、当該 plugin は staging copy を fail-fast しなければならない。cache/artifact は cache policy として別仕様に分離し、暗黙に全 cache を持ち込んではならない。

## Overlay Contract

overlay は対象 node の JSON 構造に対して committed data を差分更新する。copy-on-write node では `patchData` に差分を蓄積し、effective committed data は `copyOnWriteOf.data + patchData` として解決する。`patch-source` では対象 node の `data` に直接 merge する。

初期仕様:

- `overlay.nodes[*].match.path` は staging root からの相対 node path。
- `overlay.nodes[*].match.path: "."` は staging root 自身を表す。
- `overlay.nodes[*].match.path: "./<name>"` は staging root 直下の child path を明示する表記であり、`<name>` と同じ target に正規化する。
- staging root の display name は root path alias ではない。`"<name>"` は常に `"./<name>"` と同義であり、root 直下の child path として解釈する。root 自身を対象にする場合は必ず `.` を使う。
- path は `/` 区切りの表示/論理 path とし、空 path、`..`、空 segment、途中 segment の `.` を禁止する。
- path grammar は POSIX-style `/` 区切りだけを定義する。`\` は path separator として解釈しない。
- sibling に同名 node が存在しないことは tree invariant であるため、display name path は一意に解決できる。もし duplicate sibling name を検出した場合は data integrity error として fail-fast する。
- `overlay.nodes[*].data` は対象 node の effective committed data に merge する object。copy-on-write node では merge 結果を `patchData` として保持する。
- overlay により変更された対象 node は、既存の `metadata.buildMetadata` を保持したうえで `metadata.buildMetadata.buildRequired: true` に更新する。これにより後続の `build` action は変更済み node を build target として収集できる。
- object field は再帰 merge する。
- scalar は replace する。
- array は replace する。
- field deletion、array item patch、move、conditional patch は初期仕様に含めない。`$schema` など `$` で始まる key は通常の JSON property として扱い、operation として解釈しない。
- 複数 overlay は atomic に適用する。path 解決、duplicate path 検出、target mode 検証、payload object 検証のいずれかが失敗した場合、先行 overlay の変更を保存してはならない。

単純 merge で表現できない操作は後続仕様で定義する。初期実装で独自拡張や曖昧な patch 記法を追加してはならない。

overlay 対象 node が見つからない場合は fail-fast する。似た名前の node を推測してはならない。

## Reference / Dependency Resolution Contract

Tree hierarchy の枝の間には、node data が表す参照関係と依存関係が存在する。たとえば route node は、始点・終点の location node 定義を参照する。location node は shape の centroid として定義される場合があり、また location 自身がいずれかの shape に属するものとして定義される場合もある。

staged-folder-action runner は、action 実行前に action が必要とする reference / dependency を effective hierarchy 上で解決しなければならない。ここでの effective hierarchy は、source subtree、copy-on-write staging、`patchData` overlay、`import-mount` された mounted content、`patch-source` の直接変更を反映した読み取り結果である。

用語:

| Term | 意味 |
| --- | --- |
| reference | node data 内に保持される node ID、path、logical key、plugin 固有 key など、別 node/data を指すリンク。runtime で遅延解決される |
| pending reference | 現時点の effective hierarchy では解決できないが、後続 import/mount/overlay によって解決され得る lazy reference |
| dependency | action が地理的図形データ、build artifact、simulation input などへ焼き込むため、存在・整合・利用可能でなければならない参照先または派生入力 |

reference は必ずしも action 実行の停止条件ではない。location が route の始点/終点として参照される、location が shape centroid として参照される、location が shape 所属を参照する、といった関係は runtime で遅延解決される。この段階で解決できない reference は pending reference として記録し、action schema が hard prerequisite として指定しない限り warning として表示し、処理を継続してよい。

dependency は停止条件である。たとえば vector tile build によって route/location/shape の参照関係が地理的図形データとして artifact に焼き込まれる場合、その参照先は build input dependency になる。解決不能な dependency は typed error として fail-fast する。

reference / dependency resolver は plugin ごとの schema を使って、少なくとも以下を検出する。

- 参照先 node が存在しない。
- 参照先 node は存在するが、expected node type / role / data schema と一致しない。
- route が参照する start/end location が staging hierarchy、mounted content、または許可された external reference scope に存在しない。
- location が参照する shape centroid / shape membership が解決できない。
- `copyOnWriteOf` の参照先が存在しない、または循環する。
- `patchData` 適用後に参照 field が不正な型または不正値になる。
- `import-mount` の safe unmount 対象に、後続 action または active session からの未解決参照が残っている。
- build / capture / simulation / diagnostics が必要とする Group/Relation store participant data が idMap または mount record から解決できない。

解決不能な reference は pending reference として progress / result に記録する。warning は pending reference のユーザー向け表示であり、内部状態の SSOT ではない。解決不能な dependency は runtime warning に落とさず typed error として fail-fast する。runner は似た名前、近い location、過去 session、UI selection、plugin default から参照先を推測してはならない。

typed error には、可能な限り以下を含める。

- dependent node ID / path
- missing or invalid reference field path
- expected target type / role
- actual target information if present
- action type and action index
- mount ID if the dependency crosses an `import-mount` boundary
- plugin ID or resolver ID

pending reference / warning には同じ診断情報を含めるが、exit code は成功のままでよい。pending reference を success result から欠落させてはならない。

pending reference は action sequence の進行に応じて再解決する。たとえば route definition を先に `import-mount` し、その時点では start/end location が存在しない場合、runner は unresolved route location を pending reference として記録して import を成功させる。後続 action で location definition を `import-mount` した場合、runner は pending reference を再評価し、解決済みに遷移させる。location が存在しないまま vector tile build を開始する場合、その pending reference は build input dependency に昇格し、typed dependency error として失敗する。

preview / Map UI 表示では、pending reference は warning として表示する。表示可能な部分は表示してよいが、未解決 location や shape membership を推測補完してはならない。

依存関係の扱いは action 固有 prerequisite の一部である。`build` action は build target collection 前に build input dependency を検証し、vector tile build など artifact に参照値を焼き込む処理では dependency 未解決を失敗にする。`map-image-capture` action は requested layer と viewport/capture dependency を検証する。`folder-diagnostics` は dependency error を失敗として返す mode と、診断結果として列挙する mode を action schema で明示的に分けなければならない。

## Artifact Dependency Lifecycle Contract

vector tile などの build artifact に reference が地理的図形データとして焼き込まれた場合、その reference は artifact dependency edge になる。これは元データを絶対に編集不可にするための制約ではなく、artifact と元データの整合状態を管理し、必要な incremental rebuild plan に接続するための lifecycle record である。

例:

- route の始点/終点 location が vector tile geometry に焼き込まれた場合、その location の緯度経度は artifact dependency target field になる。
- location が shape centroid として焼き込まれた場合、centroid の元になる shape geometry と location の centroid 関係は artifact dependency edge になる。
- location が shape membership を焼き込まれた場合、membership を変える編集は dependent artifact を stale にする。

artifact dependency edge は build artifact / dependency index / mount record から追跡できなければならない。TreeNode.data に参照元セットを埋め込まず、artifact/build result 側が作成した dependency index を SSOT とする。編集 UI、CLI overlay、`patch-source`、import/mount cleanup は dependency index を逆引きし、影響を受ける artifact と incremental rebuild target を特定する。

Phase 2 child #1588 では、dependency index の永続化境界を runtime-worker 管理の dedicated Dexie store として導入する。CoreDB の tree/node schema は YAML activation の canonical native version と強く結合しているため、この child issue では CoreDB 本体の version を上げない。dependency lifecycle store は `TreeNode.data` ではなく artifact 側 index を SSOT とし、後続の edit/overlay/patch-source 経路は source data の変更と lifecycle store 更新を同一 action sequence の必須 step として扱う。source data と lifecycle state を同じ CoreDB transaction へ統合するかどうかは、YAML canonical DB versioning と合わせて別 issue で再確定する。

dependency edge は少なくとも以下の状態を持つ。

| Status | 意味 |
| --- | --- |
| `active` | artifact と参照先 data field が整合している |
| `stale` | 参照先 data field が変更され、artifact が古くなっている |
| `rebuilding` | stale artifact に対する incremental rebuild が予約または実行中 |
| `resolved` | rebuild 完了により古い edge が新しい active edge に置き換えられた |
| `orphaned` | artifact、source node、target node、mount record のいずれかが失われ、診断が必要 |

`active` edge がある field を変更する場合、実装は元データだけを黙って変更してはならない。変更は以下を同一 transaction または同一 action sequence 内で行う必要がある。

1. dependency index を逆引きし、影響を受ける artifact / build target / dependent node を列挙する。
2. ユーザー承認、または action schema の明示的な `allow-stale-and-rebuild` 相当の指定を確認する。
3. 参照先 data field を変更する。
4. 影響 artifact の dependency edge を `stale` にする。
5. 必要な incremental rebuild plan を作成し、build queue に登録するか、structured result に rebuild-required として返す。

`stale` artifact を preview / capture / export / backup に使う場合、action schema は扱いを明示しなければならない。正確性が必要な action は stale artifact を typed error として拒否する。診断用途の action は stale warning として列挙してよい。

incremental rebuild が成功した場合、古い edge は `resolved` に遷移し、新しい artifact から `active` edge を作成する。rebuild が失敗または中断した場合、edge は `stale` または `rebuilding` として残り、UI/CLI で説明できなければならない。

この仕様は、従来の実装が許していた「vector tile に焼き込んだ後、Dexie/IndexedDB 上の元データだけを変更して artifact と矛盾する状態」を禁止する。ただし、通常の修正作業を禁止するものではない。正しい修正手順は、元データ変更と artifact stale 化、差分 rebuild plan 作成を不可分に扱うことである。

実装範囲は広い。最低限、dependency index、編集ガード、overlay/patch-source 経路、build artifact 管理、incremental build queue、Map UI stale 表示、CLI result、cleanup/mount lifecycle をまたぐテストが必要である。部分実装で元データだけを変更できる抜け道を残してはならない。

## Dependency Status UI Contract

DependencyEdgeStatus は UI でも確認・操作できなければならない。ただし、UI surface ごとに扱う粒度が異なる。

TreeTable や node 詳細 Dialog は、shape/location/route の集合的な node を扱う。ここでは個別 feature 間の edge を全件表示しない。代わりに、当該 node/subtree に含まれる dependency edge の集約状態を表示する。

集約表示は少なくとも以下を含む。

- `active` / `stale` / `rebuilding` / `orphaned` の件数。
- pending reference 件数。
- stale artifact が存在するか。
- rebuild が必要な build target の件数。
- 最も重い状態を表す badge/icon。優先度は `orphaned` > `stale` > `rebuilding` > `pending reference` > `active` とする。

folder/node ごとの build button は、dependency aggregation とは別に build availability を評価して disabled 状態を決める。UI は「ビルドボタンを押せるか」を表示都合で推測してはならない。build target resolver / dependency resolver / artifact dependency lifecycle manager が返す build availability を SSOT とする。

build availability は少なくとも以下の状態を持つ。

| Status | 意味 | Build button |
| --- | --- | --- |
| `not-buildable` | node/folder が build target を持たない、build prerequisite を満たさない、dependency error / orphaned edge / schema error により build を開始できない | disabled |
| `build-not-required` | build 可能だが、現在の source data と artifact が整合しており、rebuild すべき target がない | disabled |
| `build-required` | build 可能で、未生成 artifact、stale artifact、または再実行が必要な build target が存在する | enabled |
| `build-blocked-by-active-session` | build は必要だが、同一 target の build session が `queued` または `running` として既に存在する | disabled |

`not-buildable` と `build-not-required` はどちらも button disabled だが、ユーザー向け理由は区別して表示する。`not-buildable` では不足 prerequisite、dependency error、orphaned edge、schema error、unsupported plugin participant などの原因を表示し、diagnostics / repair flow への導線を出す。`build-not-required` では「最新」または「ビルド不要」であることを表示し、エラーとして扱わない。

`build-required` の場合だけ通常の build button を enabled にする。button 押下時には既存 folder build queue / session manager 経由で build session を作成する。既に同一 node/folder の build が `queued` または `running` の場合は、availability を `build-blocked-by-active-session` として扱い、重複投入を避けるため button は disabled とし、既存 session への導線を表示する。

Phase 1 の初期 resolver は `@hierarchidb/build-api` の `resolveBuildAvailability` / `resolveSubtreeBuildAvailability` を SSOT とする。この初期版は canonical build API availability、`metadata.buildMetadata.buildRequired` / `draftMetadata.buildMetadata.buildRequired`、呼び出し側から渡された active session set による重複抑止を評価する。TreeConsole UI は active session set を渡して重複投入を抑止する。TreeTable と Breadcrumb は folder context でロード済み descendants を resolver に渡し、配下の required target と active session を同じ判定で扱う。WorkerAPI execution host は build target collection に同じ resolver を使うが、active session preflight は標準 Worker host の追加入力接続後に同じ resolver 境界へ統合する。

Phase 2 child #1584 では、同じ resolver 境界に dependency-aware な availability contract を追加する。`DependencyEdgeStatus` は `active` / `stale` / `rebuilding` / `resolved` / `orphaned` の shared type とし、artifact lifecycle summary、plugin prerequisite failure、dependency/schema/unsupported participant diagnostics を resolver input に渡せる。resolver output は従来の `status` / `reason` に加えて `details[]` を返し、UI は disabled Build entry の理由を独自推測せずこの detail を表示する。`stale` edge が存在する場合は、対応する rebuild target ID が input に含まれていなければ contract violation として fail-fast する。`orphaned` edge、dependency error、schema error、unsupported plugin participant、plugin prerequisite failure は `not-buildable` とし、`build-not-required` と混同しない。`rebuilding` edge は対応 target ID を要求し、既に rebuild が予約または実行中であることを `build-blocked-by-active-session` 相当の disabled reason/detail として表現する。

Phase 2 child #1590 では、TreeTable context menu、Breadcrumb context menu、node info panel の Build 表示は shared resolver output を `formatBuildAvailabilityView()` で表示用 summary / tooltip / diagnostics entry label に変換する。`not-buildable`、`build-not-required`、`build-blocked-by-active-session` はいずれも disabled Build entry になり得るが、UI は `reason` / `details[]` 由来の summary と tooltip で区別する。diagnostics entry は `details[]` に error severity または dependency/schema/plugin prerequisite 系 detail が含まれる場合だけ表示し、UI component は原因を metadata や node type から再推測してはならない。

build session は modal dialog として UI 全体をブロックしてはならない。build button 押下後、session manager が閉じていても新しい session は登録され、AppBar 上の icon / badge / indicator により running session の存在を確認できなければならない。詳細進捗、pause/resume/cancel、error detail は AppBar から session manager を開いて確認する。

一方で、build 対象 node/folder とその配下で build input となる data / draftData field は、build が terminal state になるまで編集不可にする。たとえば shape dialog の data / draftData 設定 step では、build input に該当する form control をすべて disabled にする。これは modal blocking ではなく、artifact 作成中の入力整合性を守るための field-level / surface-level edit lock である。

edit lock は少なくとも以下を満たす。

- lock 対象は build target resolver が列挙した build input field、依存 target field、build target 配下の editable field である。
- lock 中の form control、Preview / Map UI feature table cell、map feature popover edit menu は disabled または read-only になる。
- lock 理由として running build session ID と対象 build target を表示し、session manager への導線を出す。
- build session が `queued` または `running` の間だけ lock する。`completed` / `failed` / `cancelled` / `auth-required` / `paused` など、処理が進行中でなくなった状態では form control を enabled に戻す。
- lock 解除は UI local state ではなく canonical build session / Worker / IndexedDB progress state を根拠にする。

lock 解除後、対象 form control は再び enabled になる。`completed` の場合は artifact dependency edge が新しい `active` edge として記録され、build availability は通常 `build-not-required` になる。`failed` / `cancelled` / `auth-required` / `paused` の場合は、編集 UI は戻るが、build result が未完了であることを warning/error として表示し、build availability は session result と dependency state に基づいて `build-required` または `not-buildable` に再評価する。

lock 解除後に artifact dependency edge が `active` の field を編集した場合、UI はその編集を通常の無害な変更として扱ってはならない。編集 commit は dependency lifecycle manager を通し、影響 artifact の edge を `stale` に遷移させ、必要な incremental rebuild plan を作る。

post-build edit によって stale が発生した場合、UI は以下を表示する。

- 編集された個別 form field / table cell / map feature popover に、build 結果との齟齬があることを示す warning。
- 当該 feature row の DependencyEdgeStatus icon。
- 当該 node dialog の step-level warning。
- TreeTable や上位 folder/node row の aggregate warning。上位 node は「齟齬を含んだ下位 node がある」ことを件数付きで示す。
- build availability を `build-required` に更新し、再ビルド button を enabled にする。

再ビルドが成功し、stale edge が新しい active edge に置き換わった場合、個別 warning、step-level warning、上位 aggregate warning は解消され、build availability は `build-not-required` に戻る。UI は warning を手動で dismiss しただけで dependency state を解消済みに見せてはならない。

TreeTable / node 詳細 Dialog では、集約 badge から dependency diagnostics view または Preview/Map UI の該当 feature table へ遷移できなければならない。集合ノードの編集 Dialog で target field を変更する場合は、dependency index の集約結果をもとに影響 artifact と incremental rebuild plan を提示する。

個別の shape/location/route feature 間の DependencyEdgeStatus は、Preview / Map UI 側で表示・編集する。Preview / Map UI の feature table は単なる read-only table ではなく、dependency edge status を踏まえて cell-level editing を行う primary edit surface である。

- feature table の各行に dependency status icon を表示する。
- feature table の編集可能 cell には、field-level dependency status を表示する。
- cell edit 開始時に dependency index を逆引きし、当該 field が `active` dependency target か、`stale` artifact に関係するか、pending reference を持つかを判定する。
- dependency 影響がない field は通常編集できる。
- `active` dependency target field の編集では、影響 artifact、dependent feature、必要 incremental rebuild target を提示し、ユーザー承認後に edit + stale 化 + rebuild plan 作成を同一 transaction または同一 action sequence として実行する。
- `rebuilding` 中の field は競合を避けるため編集禁止または explicit override required とする。どちらを採用するかは action/UI schema で明示する。
- `orphaned` edge を持つ field は通常編集ではなく diagnostics / repair flow へ誘導する。
- 地図上の個別 feature をクリックした toast / popover に dependency status icon と短い説明を表示する。
- `stale` / `orphaned` / pending reference の場合、影響 artifact、参照 field、必要 rebuild target を表示する。
- 選択 feature の編集 menu operation と feature table cell editing が、修正・stale 化・incremental rebuild plan 作成の入口になる。

cell edit は推測補完をしてはならない。たとえば route endpoint location が未解決の状態で lon/lat 相当の値を編集する場合、UI は pending reference を明示し、どの field をどの node に対して変更するのかをユーザーが確認できる状態にする。

現状の実装が feature table を表示専用としている場合、それは本仕様との差分である。実装 issue では、Preview / Map UI feature table を editable table として拡張し、dependency-aware validation、commit、rollback、stale marking、incremental rebuild enqueue のテストを追加する。

UI は stale artifact を隠して通常状態に見せてはならない。preview は stale warning を表示して継続できるが、capture/export/build など正確性を要求する action では action schema に従い、stale artifact を拒否または explicit allow-stale として扱う。

## Preview / Map UI Feature Table Gap Specification

現状の Preview / Map UI feature table は、shape/location/route の行を一覧表示する read-only surface としては利用可能である。しかし staged-folder-action と dependency lifecycle を実用化するには、現状機能だけでは不足する。本節は、ただちに Issue 化する作業項目ではなく、後続 phase で詳細設計とテスト計画へ分解するための追加仕様である。

現状実装が満たしている範囲は以下である。

- shape/location/route の feature row を floating table として表示できる。
- search、sort、selection、column visibility、column sizing、row filter、window state persistence を扱える。
- 一部の status chip、recycling indicator、metadata JSON dialog を表示できる。
- underlying data grid には `column.editable` と `onCellEdit` による最小限の inline edit API が存在する。

不足している機能は以下である。

- DependencyEdgeStatus を feature row、field cell、map feature click の各 surface で表示すること。
- pending reference、stale artifact、rebuilding edge、orphaned edge を通常状態と区別して表示すること。
- field-level dependency status をもとに cell edit の可否、警告、承認、repair flow を切り替えること。
- edit commit 時に source data update、dependency edge stale marking、incremental rebuild plan 作成を不可分に扱うこと。
- edit cancel / rollback / validation error / rebuild enqueue failure をユーザーに説明し、部分更新を残さないこと。
- map feature click の toast / popover から dependency detail と編集 menu に入れること。
- display row から plugin-owned Dexie/IndexedDB entity field への write target を明示すること。
- shape/location/route ごとに、derived display column と editable source field を区別すること。

これらは既存 table component の見た目だけの拡張ではない。Preview / Map UI feature table は、dependency-aware edit command を発行する UI surface であり、永続化の責務は Worker / plugin service / dependency lifecycle manager に置く。

## Dependency-Aware Editing Design Proposal

既存の `TanstackDataGrid` にある `column.editable` / `onCellEdit` は、入力 UI の入口としては利用できる。しかしそのまま plugin data を直接変更してはならない。実装は、grid の汎用編集 API と dependency-aware edit command を分離する。

提案する構成は以下である。

| Layer | 責務 |
| --- | --- |
| `TanstackDataGrid` | cell editor lifecycle、keyboard/blur commit、cancel、dirty visual state を扱う。dependency や plugin storage を知らない |
| `MapPreviewFloatingTable` | feature row、dependency adornment、editable column metadata、cell edit request を Preview / Map UI 用 contract へ変換する |
| shape/location/route preview adapter | display row と source entity field の対応、formatter/parser、field validation、dependency query key を定義する |
| dependency edit service | dependency index を逆引きし、edit impact、approval requirement、stale transition、incremental rebuild plan を計算する |
| plugin worker/service | plugin-owned Dexie/IndexedDB entity を transactionally update し、dependency lifecycle manager と同じ action sequence に参加する |

編集可能 column は単なる `editable: true` ではなく、次の metadata を持つ。

```typescript
type FeatureTableEditableColumn = {
  columnId: string;
  source: {
    nodeId: string;
    entityType: 'shape' | 'location' | 'route';
    entityId: string;
    fieldPath: string;
  };
  valueKind: 'string' | 'number' | 'boolean' | 'enum' | 'json' | 'geometry' | 'reference';
  dependencyRole: 'none' | 'reference-source' | 'reference-target' | 'artifact-input';
  parse: 'builtin' | string;
  validate: 'builtin' | string;
};
```

`source.fieldPath` は write target であり、display-only derived column には設定してはならない。たとえば route の `distanceMeters`、shape の `area`、bbox、vertex count は原則として derived/artifact value であり、直接編集可能 cell にしてはならない。location の `lon` / `lat`、route endpoint reference、feature name、metadata の一部などは、plugin adapter が write target を明示できる場合だけ編集可能にする。

cell edit の標準 flow は以下とする。

1. User が editable cell を開始する。
2. UI は current value、source mapping、field-level DependencyEdgeStatus を取得する。
3. User が値を変更して commit する。
4. `MapPreviewFloatingTable` は `FeatureCellEditRequest` を作り、plugin adapter に parse / validation を依頼する。
5. dependency edit service は dependency index を逆引きし、impact summary を作る。
6. 影響がない場合は、plugin service が source field を transactionally update し、UI row を refresh する。
7. `active` artifact input に影響する場合は、impact summary と rebuild plan を提示し、承認後に source update、edge stale marking、incremental rebuild enqueue を同一 command として実行する。
8. `pending reference` の場合は warning を出して edit を許可できる。ただし build/capture/export で error になる可能性を result に残す。
9. `rebuilding` の場合は初期実装では編集禁止とする。override は後続拡張とし、初期実装に暗黙導入しない。
10. `orphaned` の場合は通常編集を開始せず、diagnostics / repair flow へ誘導する。

`FeatureCellEditRequest` は少なくとも以下を含む。

```typescript
type FeatureCellEditRequest = {
  stagingRootNodeId: string;
  featureNodeId: string;
  entityType: 'shape' | 'location' | 'route';
  entityId: string;
  fieldPath: string;
  previousValue: unknown;
  nextValue: unknown;
  dependencyStatus: DependencyEdgeStatus | 'pending-reference' | 'none';
  editOrigin: 'preview-table' | 'map-feature-popover' | 'node-detail-dialog' | 'cli-overlay';
};
```

UI は `FeatureCellEditRequest` を直接 Dexie に書き込まない。write は command/service 経由に限定し、成功結果には更新後の source version、affected dependency edge IDs、created rebuild plan ID、UI refresh hint を含める。失敗結果は typed error として返し、grid は edited value を commit 済みに見せてはならない。

承認 UI は、影響がある edit だけで表示する。承認 dialog / popover は最低限以下を表示する。

- 変更対象 field。
- 影響を受ける artifact / build target / dependent feature の件数。
- stale になる edge の件数。
- enqueue される incremental rebuild plan。
- build/capture/export への影響。

shape/location/route ごとの初期 editable field は保守的に定義する。

| Entity | 初期 editable field | 初期 display-only field |
| --- | --- | --- |
| location | name、lon、lat、admin metadata、shape membership reference | centroid-derived value、resolved route endpoint label |
| route | name、mode、endpoint location reference、waypoint reference/order | distance、resolved endpoint admin label、derived geometry |
| shape | name/admin metadata、style/display metadata | bbox、area、vertex count、polygon count、built vector tile geometry |

地図上の feature click toast / popover は、feature table と同じ source mapping と dependency query を使う。別経路の編集実装を作ってはならない。popover の edit menu は、対象 feature row を feature table 上で選択し、同じ `FeatureCellEditRequest` flow に入る。

この設計は issue 化を急がない。次 phase では、まず read-only Preview 実装との差分を固定する design issue を作り、その後に DataGrid editing substrate、preview adapter、dependency edit service、plugin-specific editable fields、map popover integration、UI tests を分割する。

## Action Contract

`actions` は staging / overlay 後に実行する action sequence を定義する。`build.wait` のような boolean は使わない。runner は `actions` を順番に実行し、各 action の progress を Worker / IndexedDB に記録する。

| Actions | 処理範囲 |
| --- | --- |
| `[]` | staging 作成と overlay 適用まで実行して終了する |
| `[{ type: 'build' }]` | staging/overlay 後、既存 session manager 経由で build を terminal state まで実行して終了する |
| `[{ type: 'build' }, { type: 'map-image-capture' }]` | build terminal success 後、Map UI capture と artifact write まで実行する |
| `[{ type: 'import-mount' }, { type: 'build' }]` | export/import archive を staging hierarchy に mount し、その mounted content を含めて build する |
| `[{ type: 'export-archive' }]` | staging hierarchy またはその一部を既存 export 形式で外部 archive に出力する |
| `[{ type: 'export-csv' }]` | location/route の編集後 effective data を Step2 local-file input 互換の CSV として出力する |
| `[{ type: 'export-xlsx' }]` | location/route の編集後 effective data を Step2 local-file input 互換の XLSX workbook として出力する |

`map-image-capture` は初期仕様では `build` action の成功後にだけ実行できる。`map-image-capture` を `build` より前に置く、または `build` なしで指定する場合は contract violation とする。

cleanup は action sequence の terminal point 後に評価する。`actions: []` で `delete-on-success` または `delete-always` を指定すると staging を作ってすぐ削除するため、実装は contract violation として拒否してよい。

## Action Extension Contract

本仕様の上位概念は地図画像出力ではなく、patched folder hierarchy に対する automated action sequence である。したがって `map-image-capture` は action の一例にすぎない。

追加 action は action registry に登録された typed action として扱う。各 action は少なくとも以下を定義しなければならない。

| 項目 | 説明 |
| --- | --- |
| `type` | manifest 上の一意な action type |
| input schema | action 固有設定の strict schema。欠落値を UI default や過去 session から補完しない |
| prerequisite | 先行 action、reference/dependency resolution、build 成功、auth、network、browser、printer などの前提 |
| execution owner | runtime-worker、browser Map UI、plugin worker、external command adapter などの実行主体 |
| progress phases | Worker / IndexedDB に記録する action 固有 phase |
| result schema | stdout JSON / progress record に残す typed result |
| artifact/output policy | file、folder node、DB record、print job、backup archive などの出力先と寿命 |
| cleanup interaction | staging cleanup と action artifact の独立性 |
| failure category | action 固有 typed error category / code |

初期実装で registry に載せる action は、少なくとも `build`、`export-archive`、`export-csv`、`export-xlsx`、`import-mount`、`map-image-capture` とする。`export-archive` / `import-mount` は既存 export/import 機能を staged-folder-action の action として呼び出すための境界である。`export-csv` / `export-xlsx` は通常 export とは別に、location/route の編集後 effective data を各 plugin dialog の Step2 local-file input で再指定できる表形式ファイルとして出力する user-facing export action である。後続 action は同じ sequence model に追加する。

想定される後続 action:

- `simulation-run`: staging hierarchy を入力として simulation を実行し、result DB record または artifact file を出力する。
- `map-pdf-render`: 指定 bbox / page size / layer visibility から PDF を生成する。
- `map-print`: 指定 bbox / page size / printer profile で print job を投入する。
- `folder-diagnostics`: staging hierarchy を走査し、頂点数、feature 数、missing relation、build input completeness などを集計する。
- `backup-export`: `export-archive` を基礎に、staging hierarchy または source hierarchy を backup archive として出力する。

これらは staging / overlay / copy-on-write / cleanup を共有する一方で、action 固有の実行主体と result schema は分離する。たとえば `folder-diagnostics` は browser を必要としないが、`map-pdf-render` と `map-print` は browser または OS print subsystem を prerequisite として持つ。`backup-export` は build を prerequisite としない場合がある。

action 追加時に `StagedFolderActionRunProgress.status` の top-level enum を増やし続けてはならない。top-level status は runner 全体の状態を表し、action 固有 phase は `currentAction.phase` または action progress event に保持する。

## Export / Import Mount Action Contract

`export-archive` と `import-mount` は、既存 export/import が扱う folder/node hierarchy と付随 Dexie/IndexedDB data の static action を staged-folder-action の dynamic action sequence に接続する。

`export-archive` は staging hierarchy の一部を既存 canonical export 形式へ出力する action である。`source.path` は staging root からの相対 node path とし、`.` は staging root 自身を表す。`output.path` は config file 所在 directory からの相対 file path とし、絶対 path、NUL、`..`、空 segment を禁止する。出力された archive は action artifact であり、staging cleanup で削除してはならない。ただし action schema が明示的な temporary artifact policy を持つ場合は、その policy に従う。

`import-mount` は export/import archive を staging hierarchy の指定位置に接続する action である。`input.path` は config file 所在 directory からの相対 file path とし、絶対 path、NUL、`..`、空 segment を禁止する。`mount.parentPath` は staging root からの相対 node path、`mount.name` は mounted root の表示名である。名前衝突は fail-fast とし、自動 suffix を付けてはならない。

`import-mount.mount.lifetime` は mounted content の寿命を定義する。

| Lifetime | 意味 |
| --- | --- |
| `run` | action sequence 中だけ有効な temporal mount。runner は terminal cleanup phase で必ず safe unmount を試みる |
| `retain` | デバッグ目的で staging root 内に mount を残す。staging cleanup が staging root を削除する場合は同時に unmount する |
| `permanent` | 既存 import と同等に materialize された永続 import。automatic unmount 対象ではない |

`lifetime: run` の mounted content は、action sequence 後に残ってはならない。safe unmount は以下を満たす必要がある。

- mounted root と配下 node / Dexie data / plugin participant data を mount record から完全に特定できる。
- active build session、running action、open transaction、Map UI tab が mounted content を参照していない。
- mounted content に未処理の write / dirty state / unexported derived artifact が残っていない。
- unmount 対象外の user-owned node、draft holder、temporary-folder 内の別 staging root を削除しない。
- unmount に失敗した場合、run は cleanup failure として失敗し、原因を typed error に記録する。

`lifetime: run` は cleanup policy とは独立する。`staging.cleanup: retain` でも temporal mount は unmount しなければならない。逆に `staging.cleanup: delete-always` であっても、safe unmount の失敗を黙殺して staging root 削除だけで成功扱いにしてはならない。

`import-mount` は既存 import file を参照するため、manifest には archive 内の raw node payload を展開して書かない。archive format validation、participant compatibility、schema version mismatch は `import-mount` action の validation または execution error とする。

## CSV / XLSX Export Action Contract

`export-csv` / `export-xlsx` は通常の canonical export とは別の action である。通常 export は folder/node hierarchy と付随 Dexie/IndexedDB data を再 import 可能な形で保存する。一方、`export-csv` / `export-xlsx` は location / route node について、ユーザー編集後の内容一覧を、各 plugin dialog の Step2 で local file import source として指定できる CSV / XLSX file として出力する。

`export-csv` / `export-xlsx` は以下を満たす。

- 対象は location node、route node、またはそれらを含む folder subtree である。
- `source.path` は staging root からの相対 node path とする。TreeTable context menu から実行する場合は、選択 node を source とする。
- `entityType` は `location` / `route` のいずれかを明示する。folder subtree に両方が含まれる場合も、1 action は 1 entity type だけを書き出す。
- 出力値は committed data、draftData、copy-on-write `patchData`、post-build edit を反映した effective data である。
- 出力 schema、required column、column name、value encoding は、当該 location/route dialog の Step2 で local file import source として受け付ける schema と互換でなければならない。
- Step2 import schema が更新された場合、tabular export schema も同じ versioned adapter で更新する。import と export が別々の column mapping を持って乖離してはならない。
- Step2 local-file import は未知カラムを無視しなければならない。未知カラムは warning なしで無視してよいが、required column の欠落、不正型、不正値は従来通り validation error とする。
- build artifact の geometry や cache binary を CSV / XLSX に暗黙展開してはならない。tabular export は Step2 local-file input が表す source data / editable field / reference field を対象にする。
- stale edge、pending reference、orphaned edge がある場合、`includeDependencyStatus: true` では diagnostic status column を追加出力してよい。この column は Step2 import では未知カラムとして無視されるため、round-trip import 互換性を壊さない。`includeDependencyStatus: false` でも、stale/pending/orphaned が存在することは action result warning に残す。
- column order は Step2 local-file input adapter が定義する canonical import/export order を既定とする。manifest の `columns` が指定された場合、export adapter が生成できない column、required column の欠落、Step2 import schema と互換でない required column set は fail-fast する。ただし Step2 import 側は file 内の未知カラムを無視する。
- derived display column は、Step2 import schema が明示的に受け付ける field でない限り出力してはならない。UI 表示用の resolved label、distance、bbox、area、artifact-derived geometry などを再 import 可能な source column のように出力してはならない。

`export-xlsx` の出力は workbook 形式とし、初期仕様では 1 entity type につき 1 worksheet を出力する。`output.sheetName` が未指定の場合、実装は Step2 local-file input adapter が定義する stable default sheet name を使ってよい。ただし空 sheet name、不正文字、重複 sheet name、Excel の上限を超える sheet name は fail-fast する。cell type は Step2 import schema の column metadata に従い、数値、真偽値、日付相当、文字列を区別してよいが、未知型を推測変換してはならない。

CSV / XLSX export は canonical backup ではない。ただし本 action が出力する file は、同じ plugin version の Step2 local-file input で再指定できることを互換性要件とする。CSV / XLSX から既存 node へ差分 patch する action は別 action として設計する。

UI では、location/route node の context menu にある `Export` submenu から `Export edited rows as CSV` と `Export edited rows as XLSX` 相当の項目として呼び出せなければならない。これらの submenu item は通常 export と並ぶが、意味は区別する。

Context menu の availability は以下に従う。

| 対象 | CSV / XLSX export item |
| --- | --- |
| location/route node | enabled |
| location/route を含む folder | enabled。ただし entity type 選択または submenu item 分割が必要 |
| shape node | disabled。本仕様の Step2 local-file round-trip export 対象外 |
| build artifact/cache only node | disabled |
| unsupported plugin node | disabled |

CSV / XLSX export 実行時は modal blocking を必須としない。短時間で完了する場合は file save dialog / toast result でよい。長時間または subtree 対象の場合は staged-folder-action run progress に接続し、AppBar session indicator / session manager で確認できるようにする。

## Build Contract

`build` action の `mode` は初期仕様では `session-manager` のみ許可する。

`session-manager` は以下を意味する。

- staging root に対して既存 folder build target collection を実行する。
- canonical build API を持つ node を build candidate とし、そのうち `metadata.buildMetadata.buildRequired` または `draftMetadata.buildMetadata.buildRequired` が true の node だけを build target とする。
- copy-on-write build target を `committed` source で開始する場合、canonical build input は TreeQueryService/effective data resolver が返す effective committed data を使う。raw updater node の `data: null` を canonical build input として使ってはならない。
- build candidate が 1 件も存在しない場合は `not-buildable` として fail-fast する。
- build candidate は存在するが build target が 0 件の場合は、build 不要として build session を作成せず no-op completed とする。
- build-ready target を既存 `BuildJobQueue` と canonical build session に登録する。
- AppBar の session manager で queue/session progress を表示する。
- plugin ごとの build logic、Worker、IndexedDB、cache identity、auth-required semantics は既存経路を使う。
- `build` action では CLI は build queue が terminal state になるまで待つ。
- `actions: []` では build queue を作成しない。

## Package Placement Contract

本機能の package 境界は issue ごとの局所判断で決めない。以下を正とする。

| 領域 | 配置 |
| --- | --- |
| Staged folder action manifest / CLI argument validation / typed manifest errors | `@hierarchidb/staged-folder-action` |
| Staged folder action run progress contract types | `@hierarchidb/staged-folder-action` |
| Map image capture action intent types | `@hierarchidb/staged-folder-action` |
| CSV / XLSX export action intent/result types | `@hierarchidb/staged-folder-action` |
| TreeNode optional fields `copyOnWriteOf` / `patchData` | `@hierarchidb/tree-api` |
| CoreDB を使う effective data resolver 実装 | `@hierarchidb/runtime-worker` |
| `temporary-folder` system holder lifecycle | `@hierarchidb/runtime-worker` |
| overlay application and staging runner | `@hierarchidb/runtime-worker` |
| Worker / IndexedDB progress persistence | `@hierarchidb/runtime-worker` |
| location/route Step2 local-file import/export adapter and column metadata | each location/route plugin package |
| TreeTable context menu `Export` submenu integration | `app/src/router/pages/tree/console/*` |
| AppBar session manager / build queue UI integration | `app/src/router/pages/tree/console/*` and `app/src/components/BuildSessionQueuePanel.tsx` |
| Existing Map UI capture execution | `app/src/router/routes/map/*` |

`@hierarchidb/staged-folder-action` は staged folder action 固有 contract package である。TreeNode の汎用 shape は `@hierarchidb/tree-api` に置き、staged folder action 固有の manifest/action/progress contract は `@hierarchidb/staged-folder-action` に置く。runtime-worker はそれらの contract を使って storage / Worker / CoreDB に接続する。旧 map image export 用の専用 route / parser / browser API contract は staged-folder-action の public API として残してはならない。

## Map Image Capture Action Contract

`map-image-capture` action の `mode` は初期仕様では `map-ui` のみ許可する。画像出力は必ず新規 tab で通常 Map UI を開き、指定 viewport/bbox/layers を反映して作成する。

headless で実行するか、実際のブラウザ画面を表示して実行するかは manifest ではなく CLI の `--browser headless|headed` で指定する。どちらの場合も専用 route は使わない。既存 Map UI / route / component を利用する。

manifest に `map-image-capture` action が含まれる場合、CLI は `--browser headless` または `--browser headed` を必須とする。`map-image-capture` action が含まれない場合、`--browser` は意味を持たないため指定してはならない。

`map-image-capture` action は build 完了後にだけ開始する。build が失敗、paused、auth-required、cancelled の場合は capture しない。

`map-image-capture.layers[*].path` は staging root 相対の display-name path として解釈する。`.` は staging root 全体を指す。`My Folder` と `./My Folder` はどちらも staging root 直下の `My Folder` を指す。`/My Folder`、空 segment、`.` segment、`..` segment は invalid path とする。`\` は path separator として扱わない。

`layers` は記載順に適用する。`visible: true` は指定 path の subtree を表示対象に追加し、`visible: false` は指定 path の subtree を表示対象から除外する。指定 path が解決できない場合、Map UI は capture readiness を `error` とし、browser handoff は画像ファイルを書き出してはならない。

render ready 条件:

- staging root 配下の requested layers が解決できる。
- `map-image-capture.layers[*].path` が staging root から解決できる。
- requested layers の reference / dependency が解決できる。
- bbox と viewport size が反映されている。
- MapLibre が idle である。
- canvas/WebGL が nonblank である。
- page error、unhandled rejection、WebGL context loss が発生していない。

Map UI は `data-map-image-capture-render-status="ready"` により bbox / viewport / layer visibility / MapLibre idle までを通知する。`map-image-capture.layers` が指定された場合、layer path は通常の visible filter 適用前の staging hierarchy から解決し、`visible: true` / `visible: false` の sequence によって capture 対象を決める。これにより、通常 UI では invisible な node も capture intent で明示的に含められる。

browser handoff は ready 通知後に `.maplibregl-canvas` の存在、描画サイズ、sampled pixel の nonblank を検査し、blank の場合は画像ファイルを書き出さず失敗として progress に記録する。nonblank 判定では、RGBA の全 channel が 0 の pixel のみを blank と扱う。不透明な黒 pixel は有効な描画として扱い、blank と誤判定してはならない。browser handoff は page error、unhandled rejection、WebGL context loss も収集し、1件でも存在する場合は画像ファイルを書き出さず失敗として progress に記録する。

## Progress SSOT

progress は Worker / IndexedDB 管理を正とする。最低限、以下を記録する。

```typescript
type StagedFolderActionRunProgress = {
  version: 1;
  runId: string;
  sourceNodeId: string;
  outputParentNodeId?: string;
  configPath: string;
  stagingMode: 'temporary-copy' | 'permanent-copy' | 'patch-source';
  actions: string[];
  browserMode?: 'headless' | 'headed';
  profileName: string;
  stagingRootNodeId?: string;
  buildQueueId?: string;
  currentAction?: {
    index: number;
    type: string;
    phase: string;
  };
  actionResults: StagedFolderActionResult[];
  status:
    | 'validating-config'
    | 'preparing-staging'
    | 'applying-overlay'
    | 'running-action'
    | 'auth-required'
    | 'paused'
    | 'cleaning-up'
    | 'completed'
    | 'failed'
    | 'cancelled';
  error?: {
    category: string;
    code: string;
    message: string;
    path?: string;
    nodeId?: string;
    cause?: string;
  };
};
```

CLI は manifest parse、staging 作成、overlay、artifact/output write、cleanup など CLI 主導 phase も progress API に報告する。これはデバッグのため必須である。

## User Scenarios

### 一時 staging を作って地図画像を出力する

1. ユーザーは既存 folder node ID を `--source-node-id` として指定する。
2. config は `staging.mode: temporary-copy`、`actions: [build, map-image-capture]`、`cleanup: retain` を指定する。
3. CLI は source folder を `temporary-folder` へ copy-on-write node tree として作成し、staging root を作る。
4. `--output-parent-node-id` は不要である。
5. overlay を staging node data に適用する。
6. 既存 session manager で `build` action が開始される。
7. ユーザーは AppBar の session manager で進捗を確認できる。
8. build 完了後、新規 tab の通常 Map UI で画像が作成される。
9. staging root は残り、デバッグに使える。

### 一時 staging を作って診断だけを実行する

1. ユーザーは既存 folder node ID を `--source-node-id` として指定する。
2. config は `staging.mode: temporary-copy`、`actions: [{ type: 'folder-diagnostics' }]`、`cleanup: retain` を指定する。
3. CLI は source folder を `temporary-folder` へ copy-on-write node tree として作成し、overlay を適用する。
4. diagnostics action は staging hierarchy の effective data を読み、頂点数や missing relation を集計する。
5. build や browser は prerequisite でないため起動しない。
6. result と progress record は保持され、staging root もデバッグ用に残る。

### export archive を temporal mount して処理する

1. ユーザーは既存 folder node ID を `--source-node-id` として指定する。
2. config は `import-mount` action で既存 export/import archive file を参照し、`mount.lifetime: run` を指定する。
3. CLI は staging root を作り、archive を staging hierarchy の指定 folder 配下へ mount する。
4. 後続の build、diagnostics、map-image-capture などは mounted content を通常 node hierarchy として参照する。
5. action sequence が terminal になった後、runner は staging cleanup の前に safe unmount を実行する。
6. `staging.cleanup: retain` でも `lifetime: run` の mounted content は残らない。

### staging に対して simulation と backup を順に実行する

1. config は `actions: [build, simulation-run, backup-export]` を指定する。
2. `simulation-run` は build 成功を prerequisite として実行される。
3. `backup-export` は simulation の result artifact を含めるかどうかを action input schema で明示する。
4. どの action が失敗しても後続 action は実行せず、失敗 action の typed error と完了済み action result を保持する。

### permanent copy を作って地図画像を出力する

1. ユーザーは既存 folder node ID を `--source-node-id` として指定する。
2. ユーザーは結果を置く親 folder node ID を `--output-parent-node-id` として指定する。
3. config は `staging.mode: permanent-copy` と `actions: [build, map-image-capture]` を指定する。
4. CLI は source folder を output parent 配下へ copy-on-write node tree として作成し、staging root を作る。
5. overlay/build/capture は temporary copy と同じ正規経路で進む。

### 既存 folder に直接 patch して action を実行する

1. config は `staging.mode: patch-source` を指定する。
2. CLI は `--source-node-id` の node/folder に直接 overlay を適用する。
3. build/session/capture は通常経路で進む。
4. 既存データを書き換えるため、実装は実行前に明示 confirmation または `--allow-in-place` のような追加 CLI option を要求してよい。

### 既存 folder を複製して差分 overlay する

1. source folder はテンプレートとして扱う。
2. config は差分 `overlay.nodes[*].data` だけを書く。
3. CLI は `copyOnWriteOf` と `patchData` を持つ staging root を作る。
4. overlay 後の staging root にだけ build/capture を行う。
5. 元 folder は変更しない。

## 現状実装との差分

- 専用 route を正規 route とする案は撤回する。
- `BuildJobQueue.mode = 'export'` は今後も利用候補だが、専用 route のためではなく staging folder build を表す mode として再定義する。
- Phase 0 実装では `StagedFolderActionProgressStore` を canonical build runtime adapter として登録し、TreeConsole AppBar に staged-folder-action runtime 用の badge button を追加する。これにより staged-folder-action run は既存 session manager surface から確認できる。ただし shape build session と staged-folder-action run を1つの統合 queue として並べる UI、action-specific detail、capture/output/cleanup の詳細表示は後続 phase で拡張する。
- TreeNode hierarchy の複製は `CoreDB.duplicateSubtreeWithMap()` 相当を基礎にできるが、copy-on-write node として `copyOnWriteOf` / `patchData` を持たせ、effective data 解決を build / Map UI / capture の読み取り経路に接続する必要がある。
- Phase 0 実装では temporary-copy / permanent-copy について CoW subtree 作成、Map UI/capture の TreeQueryService 経由 effective data 読み取り、canonical build session 開始時の CoW effective committed data 読み取りを接続済みである。Preview feature table、TreeTable、CSV/XLSX export、diagnostics への resolver 接続は後続 phase で行う。
- Phase 0 実装では runtime-worker が staged-folder-action runner 用の core dependency adapter を提供する。この adapter は `temporary-copy` の CoW staging、`permanent-copy` の output parent 配下 CoW staging、`patch-source` の source node staging、overlay 適用、temporary-copy cleanup policy を CoreDB 上で実行する。
- Phase 0 実装では WorkerAPI に `runStagedFolderAction(input)` を追加し、WebUI または後続 CLI bridge から同一 application profile の Worker 内 runner を起動できる。WebUI 側の標準入口として `@hierarchidb/ui-worker-client` の `BuildWorkerBridge.runStagedFolderAction(input)` も同じ WorkerAPI method に転送する。WorkerAPI execution host は staging/overlay/action/cleanup の状態を `StagedFolderActionProgressStore` に記録する。`build` action では、staging root 自身が canonical build API を持つ場合は root を build candidate とし、folder など直接 build できない場合は配下 descendants から canonical build API を持つ node を candidate として収集する。candidate のうち `buildRequired` な node だけを build target とし、candidate がない場合は fail-fast、candidate はあるが target がない場合は no-op completed とする。各 build target は既存 canonical build session を開始し、terminal state まで待つ。`completed` 以外の terminal state は action failure として扱う。
- Phase 1 初期実装では `@hierarchidb/build-api` に build availability resolver を追加し、WorkerAPI execution host の build target collection、TreeTable context menu、Breadcrumb context menu、通常 TreeConsole build flow の `buildRequired` 判定を共有 API 経由に寄せる。TreeTable context menu と Breadcrumb context menu は folder context でロード済み descendants と active session set を resolver に渡す。通常 TreeConsole build flow は現時点で `isNodeBuildRequired` を共有し、完全な availability status 表現は後続 phase で統合する。
- Phase 1 初期の WorkerAPI execution host は optional `runMapImageCaptureAction` injection を受け取り、runtime-worker runner へ渡せる。`map-image-capture` intent、Map UI readiness、capture page port helper、canvas nonblank 判定は実装済みだが、標準 Worker bootstrap / CLI bridge はまだ headed/headless browser host を注入しないため、未注入時の WorkerAPI run は `map-image-capture action runner is not configured` として fail-fast する。
- 追加定義が必要なのは、build 入力が TreeNode.data 以外の Group/Relation store に存在する plugin の copy-on-write 参照または materialize participant 境界である。
- 現状の Preview / Map UI feature table は read-only 一覧としては使えるが、DependencyEdgeStatus 表示、field-level status、dependency-aware cell editing、map feature popover 連動、stale 化と incremental rebuild plan 作成の入口としては不足している。この不足分は本仕様で追加仕様として定義し、ただちに Issue 化せず次 phase で詳細設計から分解する。

## 後続 Issue 分割

1. staging/overlay manifest parser を実装する。
2. source node から temporary folder または output parent 配下へ staging copy を作る。temporary-copy / permanent-copy は Phase 0 で実装済み。
3. effective data resolver を実装し、build / Map UI / Preview / TreeTable / CSV/XLSX export / reference resolver / diagnostics から独自解決コードを排除する。Phase 0 では resolver 本体と Map UI/capture の TreeQueryService 接続を実装済み。build input collection など残りの接続は後続 phase で行う。
4. overlay を copy-on-write node の `patchData` または patch-source の committed `data` に strict merge する。
5. pending reference resolver と warning/result persistence を実装する。
6. artifact dependency index と `active/stale/rebuilding/resolved/orphaned` lifecycle を実装する。
7. target field 編集時に stale 化と incremental rebuild plan を同一 transaction/action sequence で作る。
8. stale artifact の preview/capture/export/build policy を実装する。
9. build availability resolver を dependency lifecycle と plugin-specific prerequisite へ拡張し、disabled 理由表示と diagnostics / repair flow への導線を完成させる。Phase 1 初期版では canonical build API availability、`buildRequired`、呼び出し側が active session set を渡せる resolver contract まで実装済みである。
10. build button 押下後は modal blocking ではなく AppBar session indicator / session manager に登録し、対象 data / draftData field だけを canonical session state に基づいて edit lock する。
11. build 完了後の対象 field 編集で stale edge を発生させ、個別 UI、node dialog、TreeTable / 上位 folder の aggregate warning、build availability に伝播させる。
12. TreeTable / node 詳細 Dialog に集合 node の dependency status 集約 badge と診断導線を実装する。
13. Preview / Map UI の feature table row、cell editing、feature click toast/popover、編集 menu に個別 feature の dependency status と修正導線を実装する。これは即時実装 Issue ではなく、まず read-only 現状との差分と editable table substrate を固める design phase を先行する。
14. staging root を既存 folder build queue / session manager に接続する。Phase 0 では WorkerAPI execution host が build action を canonical build session に接続済みであり、root が直接 build できない場合の descendants build target collection も実装済みである。plugin 固有 prerequisite、dependency-aware availability 拡張、session manager 詳細 UI は後続 phase で行う。
15. CLI 主導 phase を Worker / IndexedDB progress state に報告する。Phase 0 CLI は dry-run validation host までであり、WorkerAPI execution host への CLI bridge は後続 phase で行う。
16. `map-image-capture` action intent を実装する。Phase 0 では intent store、WorkerAPI の intent read、Map UI readiness、browser page port helper を実装済みである。
17. `export-csv` / `export-xlsx` action intent、location/route Step2 local-file import/export adapter、TreeTable context menu `Export` submenu item を実装する。
18. CLI の `--browser headless|headed` に応じて新規 tab の Map UI capture を実行する。
19. cleanup policy を実装する。

dependency lifecycle 実装は、既存編集 UI、CLI overlay、`patch-source`、import/mount、build artifact 管理、incremental build queue、Map UI、export/backup、CSV / XLSX export に影響する可能性が高い。テストは単一 package だけで完結させず、service-level、CoreDB/Dexie integration、effective data resolver slot/merge/error tests、UI guard、TreeTable/Dialog aggregate UI、Preview/Map feature-level editable table UI、cell edit commit/rollback、build button availability、build-running edit lock、post-build edit stale warning propagation、location/route Step2 local-file import/export schema round-trip、CSV / XLSX export column/status output、CLI result、incremental rebuild queue、cleanup/mount lifecycle を分けて作成する。

## Rollback

本仕様は documentation contract である。rollback は本ファイルと関連 docs の revert で完了する。実装 issue では staging/capture を既存 UI route と build session manager の外側に隔離せず、feature flag または未公開 command として段階導入する。
