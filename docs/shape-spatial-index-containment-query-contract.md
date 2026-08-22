# Shape spatial index and containment query contract

本仕様は #548 / #1481 の spatial index と containment / adjacency query 契約を定義する。`docs/shape-border-geometry-storage-identity.md` の dataset、arc、ring、polygon reconstruction relation identity を前提とし、現行 `tileEmitBufferRelations` や vector tile output を spatial index の SSOT として読み替えない。

## Scope

### In

- spatial index record identity、ownership、更新/削除 lineage
- containment query、arc lookup query、adjacency query の入力、出力、失敗条件
- tileEmit 用 relation と reusable spatial index の責務分離
- fixture / regression / benchmark の検証カテゴリ
- 後続 storage implementation issue が参照する query contract

### Out

- production code changes
- IndexedDB / Dexie schema implementation
- geometry algorithm implementation
- `tileEmitBufferRelations` の adjacency / containment SSOT 化
- vector tile output への fallback query
- missing index の silent rebuild または stale artifact reuse

## Ownership Boundary

Spatial index は border geometry dataset に所有される。index record は必ず `datasetId`、`nodeId`、`sourceKey`、`schemaVersion`、`indexConfigHash` を持ち、`docs/shape-border-geometry-storage-identity.md` の dataset identity と一致しなければならない。

既存 record の責務は次のとおり分離する。

| Record | Owner | Allowed use | Forbidden use |
| --- | --- | --- | --- |
| `tileEmitBufferRelations` | tileEmit task planning | geometry buffer と tileEmit task の入力 relation | containment、adjacency、shared-border lookup の SSOT |
| `vectorTiles` / `tileSummaries` | final tile output | rendered/preview tile output | source topology または containment query の fallback source |
| `geometryCache` | geometry artifact cache | band 単位の simplified FGB artifact | reusable spatial index、arc graph、polygon relation storage |
| border spatial index | #548 border geometry path | containment、arc lookup、adjacency query | tileEmit task scheduling の implicit replacement |

## Spatial Index Record Identity

Spatial index record は次の field を必須とする。

| Field | Contract |
| --- | --- |
| `indexId` | dataset 内で一意な opaque id。 |
| `datasetId` | border geometry dataset identity。 |
| `nodeId` | dataset owner node。query target と一致しなければならない。 |
| `sourceKey` | dataset の canonical `${countryCode}:${adminLevel}`。 |
| `indexKind` | `arcBounds`、`ringBounds`、`polygonBounds`、`tileCover` のいずれか。 |
| `indexConfigHash` | index precision、tiling、bbox normalization、schema revision の canonical hash。 |
| `bounds` | finite WGS84 bbox。非 finite、min/max 反転、範囲外座標は契約違反。 |
| `targetIds` | indexKind に対応する arc/ring/polygon ids。空配列は明示的な empty index cell としてのみ許容する。 |
| `createdFromRevision` | dataset revision と一致する非空値。 |

Index key の serialization は field 欠落を空文字へ落とさず、bbox の丸めや clamp を行わない。precision を落とす必要がある場合は `indexConfigHash` に含め、reader が推測してはならない。

## Query Contracts

### Containment Query

Containment query は point または bbox と dataset identity を入力に、candidate polygon/ring ids を返す。

| Input | Contract |
| --- | --- |
| `datasetId` | 必須。active node の dataset と一致する。 |
| `nodeId` | 必須。cross-node query は拒否する。 |
| `geometry` | point または bbox。finite WGS84 範囲内。 |
| `indexConfigHash` | caller が期待する index config。保存済み record と一致しない場合は error。 |

Output は candidate ids と index metadata を返す。containment の最終判定が必要な場合は、query result を topology record に対して再検証する。index hit だけを polygon containment の確定結果として扱わない。

Failure conditions:

- dataset / node ownership mismatch
- index record missing
- index config mismatch
- non-finite または WGS84 範囲外 query geometry
- stale `createdFromRevision`
- required target record missing

上記は visible error とする。vector tile output、tileEmit relation、stale geometry cache からの fallback query は禁止する。

### Arc Lookup Query

Arc lookup query は bbox、endpoint hash、または arc id から candidate arc ids を返す。`classification` filter は `coastline` / `sharedBorder` のみ許容する。未知 classification、空 endpoint hash、dataset 不一致は契約違反として拒否する。

Arc lookup は shared-border extraction と simplification の検証補助であり、arc identity の生成元ではない。lookup 結果の曖昧性を snap や owner 補完で解消してはならない。

### Adjacency Query

Adjacency query は shared-border arc relation を前提に、polygon または administrative unit の neighbor candidates を返す。

| Input | Contract |
| --- | --- |
| `datasetId` | 必須。 |
| `polygonId` or `unitId` | 少なくとも一方が必須。両方指定時は同一 ownership を検証する。 |
| `classification` | `sharedBorder` のみ。coastline は adjacency として返さない。 |

Output は neighbor id、shared arc ids、relation metadata を含む。隣接関係は shared-border arc record から導出するか、後続実装で独立 adjacency index として保存する。いずれの場合も `tileEmitBufferRelations` や rendered tile overlap から推測してはならない。

Failure conditions:

- polygon/unit identity が dataset に存在しない
- shared arc relation が欠落している
- owner polygon cardinality が不正
- query 対象が coastline のみ
- stale dataset revision

## Update And Delete Lineage

Spatial index は border geometry dataset の下流 artifact である。

```text
border geometry dataset
  -> arc / ring / polygon relation records
  -> spatial index records
  -> query-visible derived result
```

Dataset、arc、ring、polygon relation が削除または revision 更新された場合、該当 index record は同じ node ownership の範囲で cascade delete される。index だけを stale のまま残し、reader が query 時に旧 relation へ fallback してはならない。

Index rebuild は明示的な writer operation として扱う。reader は missing index を silent rebuild しない。必要な index が欠落している場合は visible error を返し、caller が build/rebuild task を開始する。

## Verification Categories

後続 implementation issue は少なくとも次を検証する。

- valid point/bbox containment candidate query
- index config mismatch rejection
- node/dataset ownership mismatch rejection
- stale dataset revision rejection
- missing target record rejection
- shared-border adjacency success
- coastline-only relation が adjacency にならないこと
- `tileEmitBufferRelations` / vector tile output fallback が存在しないこと
- selection/config cleanup 後に stale index が query されないこと

Benchmark は dataset size、index cell count、query latency、index rebuild cost を個別に測る。閾値は implementation issue で fixture とともに定義し、未確定値を本仕様で固定しない。

## Follow-up Issue Contracts

- #1482 は本仕様と `docs/shape-border-geometry-storage-identity.md` を storage implementation の入力契約として扱う。
- #1483 は arc lookup / adjacency query の結果を topology invariant 検証に使えるが、query の曖昧性を補正して extraction 成功扱いにしてはならない。
- #1486 は pipeline integration 時に flag off の既存 tileEmit relation と、flag on の border spatial index を明確に分離して検証する。
