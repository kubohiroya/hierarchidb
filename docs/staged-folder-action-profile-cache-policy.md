# Staged Folder Action Profile and Cache Policy

## 目的

本書は、staged folder action CLI の browser profile、IndexedDB、staging copy、cache/artifact policy を定義する。

本機能は既存 TreeConsole / session manager / Worker / IndexedDB を使う。`map-image-capture` action では既存 Map UI も使う。専用 route や通常 UI と分断された runtime を作らない。

## Browser Profile Policy

CLI は browser runtime と Worker / IndexedDB に接続する必要がある。

| Mode | CLI option | Profile | 用途 |
| --- | --- | --- | --- |
| `default` | none | default browser/application profile | 通常実行。AppBar session manager で同じ staging/progress/build session を確認する |
| `named` | `--profile <profileName>` | 指定された named profile | CI、デバッグ、特定 project 用 profile |
| `temporary-fresh` | `--fresh` | 実行ごとの一時 profile | isolated 検証 |

CLI は省略時に default profile を使う。ユーザーが `--profile <profileName>` を指定した場合は、その profile を使う。profile 名の解決規則は application/browser runtime の既存 profile 管理に従い、CLI が類似名を推測してはならない。

同一 browser profile 内では、staging root、action progress、build queue/session、Map UI capture、progress state が観測可能でなければならない。別 profile の通常 WebUI から progress を見ることは初期仕様の保証範囲外である。

## Progress Persistence

progress state は Worker / IndexedDB 管理を正とする。

- CLI 主導 phase も progress API に記録する。
- `BuildJobQueue` / canonical build session と関連付ける。
- localStorage は progress SSOT にしない。
- browser reload や CLI failure 後も、デバッグに必要な run record を読めることを目標にする。

## Staging Copy Policy

`staging.mode: temporary-copy` は source node/folder を system-managed `temporary-folder` 配下へ copy-on-write node tree として作成する。`--output-parent-node-id` は不要である。`temporary-folder` は既存の draft holder と同じ system holder 系列に属するが、draft holder そのものではない。通常不可視だが、temporary-copy の staging root が存在している間だけ、デバッグと session manager 連動のため可視化される。

`temporary-folder` の保持/削除/可視化は staged folder action staging lifecycle だけで制御する。draft commit/discard、draft enumeration、draft cleanup と共有してはならない。

`staging.mode: permanent-copy` は source node/folder を `--output-parent-node-id` 配下へ copy-on-write node tree として作成する。`--output-parent-node-id` は必須である。

`staging.mode: patch-source` は source node/folder に直接 overlay を適用する。実装は destructive-operation 許可 option を要求してよい。

copy 対象:

- tree node hierarchy
- node metadata
- `copyOnWriteOf`
- `patchData`

copy-on-write node の effective committed data は、`copyOnWriteOf` が指す参照元 node の committed `data` に `patchData` を strict merge した値である。staging copy は参照元 `data` を物理複製しない。

copy 対象外:

- active build session runtime
- transient task queue
- UI-only dialog state / draft state
- stale capture state
- build artifact/cache records
- plugin Group/Relation store records。ただし build 入力として必須な plugin は idMap に基づく copy/import participant を持つ必要がある

staging root は `staging.cleanup` に従って保持または削除する。
progress record、build queue/session record、CLI result の保持可否は staging cleanup とは独立である。

## Import Mount Policy

`import-mount` action は、既存 export/import archive を staging hierarchy に接続する。永続 import と temporal mount は区別する。

| Lifetime | Policy |
| --- | --- |
| `run` | action sequence 中だけ有効。run terminal 後、staging cleanup より前に safe unmount する |
| `retain` | デバッグ目的で staging root 内に残す。staging root が削除される場合は同時に unmount する |
| `permanent` | 既存 import と同等に materialize する。automatic unmount 対象ではない |

`lifetime: run` の mounted content は `staging.cleanup: retain` でも残してはならない。safe unmount failure は cleanup failure として structured result に記録する。

mount record は mounted root、配下 node、付随 Dexie/IndexedDB data、plugin participant data を特定できなければならない。特定できない mounted content は safe unmount できないため、`import-mount` action 自体を fail-fast する。

## Cache Policy

| Policy | CLI option | 意味 |
| --- | --- | --- |
| `reuse` | none | existing canonical build cache identity / artifact reconcile に従う |
| `fresh` | `--fresh` | 一時 profile を使い、既存 profile state を読まない |
| `offline` | `--offline` | 外部 fetch が必要な cache miss は typed error で失敗する |
| `refresh` | `--refresh` | staging target 境界の関連 cache/artifact を削除して再buildする |

`--offline` と `--refresh` は同時指定しない。

cache/artifact を staging copy 時に複製するかどうかは、初期仕様では暗黙に行わない。build 時の canonical cache identity / artifact reconcile に委譲する。copy implementation が cache/artifact を持ち込む場合は、明示 policy と検証を追加するまで禁止する。

## Refresh Boundary

`refresh` は staging target だけを対象にする。

- `staging.mode: temporary-copy` / `permanent-copy` の場合、複製された staging root 配下だけが対象。
- `staging.mode: patch-source` の場合、source node/folder 配下が対象。

無関係 node の CoreDB data、plugin DB cache、artifact、session state を削除してはならない。

## Artifact Dependency Lifecycle Policy

vector tile などの build artifact に route/location/shape の参照関係が焼き込まれた場合、その参照は artifact dependency edge として扱う。edge が `active` の間、参照先 node の該当 data field を黙って変更してはならない。

参照先 data field を変更する場合は、dependency index を逆引きして影響 artifact を `stale` にし、incremental rebuild plan を作成する。編集を禁止するのではなく、元データ変更だけが先行して artifact と矛盾する状態を禁止する。

`--refresh` は対象 staging/source boundary 内の stale artifact を再buildする policy である。full rebuild を強制するものではない。差分 rebuild が可能な場合は incremental build queue に接続する。

dependency edge の状態:

- `active`: artifact と参照先 data field が整合している。
- `stale`: 参照先 data field が変更され、artifact が古い。
- `rebuilding`: incremental rebuild が予約または実行中。
- `resolved`: rebuild 完了により古い edge が置換済み。
- `orphaned`: artifact/source/target/mount record 欠落により診断が必要。

`patch-source`、overlay、import/mount cleanup は dependency index を更新せずに target field を変更してはならない。必要な stale 化と rebuild plan を作れない場合は typed dependency error として拒否する。

## Cleanup and Debugging

cleanup は action sequence の terminal point 後に評価する。

- `actions: []`: staging/overlay 完了後。
- `build` action のみ: build queue terminal state 後。
- `build` + `map-image-capture` action: image artifact write 後。
- その他の action sequence: 最後に実行された action の terminal status と artifact/output write 後。

`staging.cleanup: retain` では staging root、progress record、build queue/session record を保持する。

`delete-on-success` / `delete-always` では staging root の削除を試みるが、progress record と structured result はデバッグのため保持する。staging cleanup が progress record を削除してはならない。

cleanup failure は typed result に記録し、完全成功として扱わない。

`import-mount.mount.lifetime: run` の safe unmount は staging root cleanup より前に評価する。safe unmount failure が発生した場合は、staging root deletion を継続するか停止するかを実装が独自判断してはならない。仕様化された failure policy がない限り、削除を停止して mounted content を調査可能な状態で残す。

`patch-source` では新規 staging root がないため cleanup 対象は存在しない。`patch-source` で `delete-on-success` または `delete-always` を指定した場合は contract violation とする。

## Rollback

本仕様のみの rollback は本ファイルの revert で完了する。実装では profile/cache/staging 操作を CLI command 境界に隔離し、通常 WebUI の既存 profile 操作に影響しないようにする。
