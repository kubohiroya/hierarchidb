# Staged Folder Action Manifest Format

## 目的

本書は、staged folder action CLI が受け付ける JSON/YAML 設定ファイルの正規形式を定義する。JSON と YAML は同じ構造を表す構文差だけであり、parse 後の意味は完全に一致する。

この manifest は node payload を直接列挙して専用 route に渡すものではない。既存 node/folder を source とし、staging、overlay、action sequence、cleanup を制御する設定である。

## CLI 引数との分担

manifest は source node を探索しない。source node は CLI 引数で明示する。output parent node は `staging.mode: permanent-copy` のときだけ CLI 引数で明示する。

```bash
hdb-staged-folder-action \
  --source-node-id <node-id-to-copy-or-patch> \
  --config <path-to-json-or-yaml> \
  [--output-parent-node-id <parent-folder-node-id-for-permanent-result>] \
  [--browser headless|headed] \
  [--profile <profileName>]
```

manifest は上記 node ID に対する処理内容だけを定義する。

## 正規構造

```typescript
type StagedFolderActionManifest = {
  version: 1;
  staging: StagedFolderActionStagingConfig;
  overlay: StagedFolderActionOverlayConfig;
  actions: StagedFolderAction[];
};

type StagedFolderActionStagingConfig = {
  mode: 'temporary-copy' | 'permanent-copy' | 'patch-source';
  name?: string;
  cleanup: 'retain' | 'delete-on-success' | 'delete-always';
};

type StagedFolderActionOverlayConfig = {
  nodes: Array<{
    match: {
      path: string;
    };
    data: Record<string, unknown>;
  }>;
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
```

初期仕様で受け付ける action type は `build`、`export-archive`、`import-mount`、`export-csv`、`export-xlsx`、`map-image-capture` である。manifest parser は unknown action type を fail-fast する。後続 action は action registry に schema を追加してから受け付ける。

## 入力境界

- `version` は `1` のみ有効。
- `staging.mode`、`staging.cleanup`、`actions` は必須。
- `actions` は array であり、空 array は staging/overlay のみを行う。
- unknown action type は validation error。
- `build` action の `mode` は `session-manager` のみ有効。
- `export-archive.format` と `import-mount.format` は初期仕様では `canonical-yaml-zip` のみ有効。
- `export-archive.source.path` と `import-mount.mount.parentPath` は staging root からの相対 node path。`.` は staging root 自身を表す。
- `export-archive.output.path` と `import-mount.input.path` は config file 所在 directory からの相対 file path。絶対 path、NUL、`..`、空 segment を禁止する。
- `import-mount.mount.name` は空でない trimmed string。
- `import-mount.mount.lifetime` は `run | retain | permanent` のみ有効。
- `export-csv` / `export-xlsx` の `entityType` は `location | route` のみ有効。`shape` は validation error。
- `export-csv` / `export-xlsx` は location/route dialog の Step2 local-file input と互換な表形式出力 intent を表す。
- `export-csv.source.path` / `export-xlsx.source.path` は staging root からの相対 node path。`.` は staging root 自身を表す。
- `export-csv.output.path` / `export-xlsx.output.path` は config file 所在 directory からの相対 file path。絶対 path、NUL、`..`、空 segment を禁止する。
- `export-xlsx.output.sheetName` を指定する場合は、Excel worksheet 名として有効な 31 文字以下の non-empty trimmed string でなければならない。
- `map-image-capture` action の `mode` は `map-ui` のみ有効。
- `staging.mode: permanent-copy` の場合、CLI の `--output-parent-node-id` が必須。
- `staging.mode: temporary-copy` の場合、CLI の `--output-parent-node-id` は不要。system-managed `temporary-folder` に copy-on-write node tree を作成する。
- `staging.mode: patch-source` の場合、CLI の `--output-parent-node-id` は不要。実装は追加の destructive-operation 許可 option を要求してよい。
- `temporary-folder` は draft holder と同じ system holder 系列だが、draft holder ではない。temporary-copy node を draft として commit/discard/enumerate してはならない。
- `staging.name` を指定する場合は空でない trimmed string。`patch-source` では staging root を作成しないため実行名としては使用しない。
- `map-image-capture` action は `build` action の後にだけ指定できる。
- `map-image-capture` action を `build` action なし、または `build` action より前に指定した場合は validation error。
- `staging.mode: patch-source` の場合、`staging.cleanup` は `retain` のみ有効。source node/folder を cleanup 対象にしてはならない。
- `map-image-capture.output.path` は相対 path。絶対 path、NUL、`..`、空 segment を禁止する。
- `map-image-capture.output.width` と `height` は正の整数。
- `map-image-capture.viewport.bbox` は `[west, south, east, north]`。
- bbox は `-180 <= west < east <= 180`、`-90 <= south < north <= 90` を満たす。
- `overlay.nodes[*].match.path` と `map-image-capture.layers[*].path` は staging root からの相対 node path。
- path は空文字、`..`、空 segment を禁止する。
- path grammar は POSIX-style `/` 区切りだけを定義する。`\` は path separator として解釈しない。
- `overlay.nodes[*].data` は object でなければならない。

欠落値を plugin default、UI default、過去 session、既存 source node からの推測で補完してはならない。

## Action Registry

manifest の `actions[]` は、registry に登録された typed action の列である。registry entry は action ごとに以下を定義する。

- action type
- strict input schema
- prerequisite validation, including pending reference warning and hard dependency error requirements
- execution owner
- progress phase names
- result schema
- artifact/output policy
- cleanup interaction
- typed error category/code

初期 registry:

| Action type | 用途 | Prerequisite | Execution owner |
| --- | --- | --- | --- |
| `build` | staging hierarchy に対して既存 build を実行する | staging / overlay success | existing folder build queue / session manager |
| `export-archive` | staging hierarchy の一部を既存 export 形式へ出力する | staging / overlay success | existing export service |
| `import-mount` | 既存 export/import archive を staging hierarchy へ import または temporal mount する | staging / overlay success、archive validation success | existing import service plus mount lifecycle manager |
| `export-csv` | location/route の編集後 effective data を Step2 local-file input 互換 CSV として出力する | location/route Step2 adapter resolvable | plugin adapter |
| `export-xlsx` | location/route の編集後 effective data を Step2 local-file input 互換 XLSX として出力する | location/route Step2 adapter resolvable | plugin adapter |
| `map-image-capture` | build 済み staging hierarchy を通常 Map UI で画像化する | successful prior `build` action | existing Map UI in a new tab |

action registry entry は、その action が必要とする reference / dependency resolver を明示する。route の start/end location、shape centroid、shape membership のような lazy reference は、resolver が解決できない場合でも pending reference として保持し、warning 表示で継続できる。一方、vector tile build など artifact に地理的図形データとして焼き込む action では、それらは hard dependency になり、解決できなければ validation または execution error として失敗する。

後続 registry 候補:

| Action type | 用途 | 備考 |
| --- | --- | --- |
| `simulation-run` | staging hierarchy を入力に simulation を実行する | build prerequisite の有無は action schema で明示する |
| `map-pdf-render` | 指定地図範囲を PDF として生成する | browser / renderer prerequisite を持つ |
| `map-print` | 指定地図範囲を印刷 job として実行する | printer profile と OS/browser print boundary を明示する |
| `folder-diagnostics` | 頂点数、feature 数、missing relation などを集計する | browser や build を不要にできる |
| `backup-export` | `export-archive` を基礎に backup archive を出力する | canonical export format と artifact policy を明示する |

後続 action を追加する場合も、`staging`、`overlay`、`cleanup` の意味を action 固有に変えてはならない。

## Import Mount Semantics

`import-mount` は manifest 内に raw node payload を展開しない。既存 export/import 機能で作成された archive file を `input.path` で参照し、その内容を staging hierarchy の `mount.parentPath` 配下に `mount.name` として接続する。

`mount.lifetime` は mounted content の寿命を決める。

- `run`: action sequence 中だけ有効。runner は terminal cleanup phase で safe unmount を実行する。
- `retain`: staging root とともに保持する。staging root が cleanup で削除される場合は unmount も実行する。
- `permanent`: 既存 import と同等の materialized import。automatic unmount しない。

`lifetime: run` の mounted content は、`staging.cleanup: retain` でも run 終了時に unmount しなければならない。unmount に失敗した場合は cleanup failure として扱う。

## Overlay Semantics

overlay は対象 node の effective committed data に対して適用する。

- object は再帰 merge。
- scalar は replace。
- array は replace。
- deletion、array item merge、move、conditional patch は初期仕様に含めない。
- 対象 path が存在しない場合は fail-fast。
- sibling name は tree invariant により一意であるため display name path は曖昧にならない。duplicate sibling name を検出した場合は data integrity error。
- 同じ path への overlay が複数ある場合は validation error。

copy-on-write node では、overlay は copied node の `patchData` に反映する。effective committed data は `copyOnWriteOf` が指す参照元 node の committed `data` に `patchData` を strict merge した値である。`patch-source` では overlay を source node の committed `data` に直接 merge する。

## YAML Example

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
  - type: import-mount
    format: canonical-yaml-zip
    input:
      path: fixtures/base-terrain.zip
    mount:
      parentPath: references
      name: terrain
      lifetime: run
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

## JSON Example

```json
{
  "version": 1,
  "staging": {
    "mode": "temporary-copy",
    "name": "tokyo-map-capture",
    "cleanup": "retain"
  },
  "overlay": {
    "nodes": [
      {
        "match": {
          "path": "routes/main"
        },
        "data": {
          "buildConfig": {
            "routeGeneration": {
              "method": "direct"
            }
          }
        }
      }
    ]
  },
  "actions": [
    {
      "type": "import-mount",
      "format": "canonical-yaml-zip",
      "input": {
        "path": "fixtures/base-terrain.zip"
      },
      "mount": {
        "parentPath": "references",
        "name": "terrain",
        "lifetime": "run"
      }
    },
    {
      "type": "build",
      "mode": "session-manager"
    },
    {
      "type": "map-image-capture",
      "mode": "map-ui",
      "output": {
        "path": "exports/tokyo.png",
        "width": 1280,
        "height": 720
      },
      "viewport": {
        "bbox": [139.5, 35.5, 140.0, 36.0]
      },
      "layers": [
        {
          "path": "routes/main",
          "visible": true
        }
      ]
    }
  ]
}
```

## 非目標

- manifest 内に raw `nodes[*].nodeType/data` を列挙して新規 tree を直接生成する形式は本仕様の正規形式ではない。
- 専用 route へ job を投入する形式は撤回する。
- 単純 merge で表現できない patch operation は後続仕様に分離する。
- registry 未登録 action を permissive に実行する plugin hook 形式は初期仕様に含めない。
