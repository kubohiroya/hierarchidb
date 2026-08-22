# Shape border geometry storage identity

本仕様は #548 / #1480 の border geometry storage 契約を定義する。対象は国境・海岸線・共有境界 arc と、後続の polygon reconstruction が参照する topology relation である。現行 runtime の `source` / `geometry` / `tileEmit` artifact を変更せず、既存 cache record を topology storage の SSOT として読み替えない。

## Scope

### In

- border geometry dataset、arc、edge、ring、polygon、reconstruction relation の正規 identity
- node ownership、dataset revision、cache identity、artifact lineage の境界
- persistent / ephemeral / generated artifact の分類
- 契約違反時の fail-fast 条件
- 後続実装 issue が参照する rollback / migration 前提

### Out

- production code changes
- IndexedDB / Dexie schema implementation
- geometry algorithm implementation
- existing `sourceCache` / `geometryCache` / `tileEmitBufferRelations` への topology field 追加
- clamp、snap、default 補完、silent repair による復旧

## Terminology

| Term | Definition |
| --- | --- |
| Border geometry dataset | 同一 `nodeId`、同一 data source、同一 ADM selection、同一 upstream revision、同一 border-geometry config から作られる topology 入力単位。 |
| Arc | 2つ以上の coordinate からなる有向 polyline。coastline arc または shared-border arc のいずれかに分類される。 |
| Edge | arc の隣接 coordinate pair。edge は arc 内部の検証単位であり、独立した ownership SSOT ではない。 |
| Ring | polygon boundary を構成する ordered arc reference の閉路。ring 自体は coordinate を複製せず、arc reference と orientation を持つ。 |
| Polygon relation | source polygon と ring / arc の対応。reconstruction の入力不変条件として保存する。 |
| Reconstruction relation | coastline/shared arc から polygon output を再構成するための ordered ring relation。 |
| Dataset revision | upstream revision と border-geometry schema/config revision を合成した非空 identity 要素。 |

## Record Classes

| Record class | Lifetime | Purpose | Must not replace |
| --- | --- | --- | --- |
| Border geometry dataset record | persistent | dataset revision、node ownership、source lineage、schema version、feature flag generation を保持する root record。 | `sourceCacheMeta` |
| Arc record | persistent | canonical arc identity、有向 coordinate sequence hash、classification、owner relation summary を保持する。 | `geometryCache` |
| Ring relation record | persistent | polygon boundary の ordered arc references と各 arc の orientation を保持する。 | `tileEmitBufferRelations` |
| Polygon reconstruction relation | persistent | source polygon identity、outer/inner ring relation、reconstruction output lineage を保持する。 | vector tile output |
| Validation artifact | ephemeral or generated | topology validation result、fixture/debug output、benchmark material。 | persistent topology SSOT |

後続実装で物理 table 名を確定する場合も、この分類を崩してはならない。既存の `EphemeralGeometryCacheRecord` は band 単位の簡略化済み FGB artifact であり、arc graph や reconstruction relation の保存先ではない。

## Canonical Identity

### Dataset Identity

Border geometry dataset identity は次の field をすべて必須とする。

| Field | Contract |
| --- | --- |
| `nodeId` | 非空の NodeId。別 node の source/cache/artifact を参照してはならない。 |
| `dataSource` | 非空の canonical data source id。UI 表示名や fallback source 名から推測しない。 |
| `countryCode` | ISO2 の canonical country code。ISO3 や欠落値を reader 側で変換しない。 |
| `adminLevel` | 整数の ADM level。欠落時に `0` を補完しない。 |
| `sourceKey` | `${countryCode}:${adminLevel}`。既存 source stage 契約と一致する非空値。 |
| `upstreamRevision` | upstream が revision を提供する場合は非空で必須。未提供の場合は明示的な `none` state を schema で表す。空文字は不可。 |
| `borderGeometryConfigHash` | border geometry 専用 config の canonical hash。source/geometry/tileEmit config hash を読み替えない。 |
| `schemaVersion` | border geometry storage schema の整数 version。 |

実装時の dataset key は上記 field の canonical serialization から作る。serialization は field 欠落を空文字に落とさず、数値丸めや trim を行わない。

### Arc Identity

Arc identity は dataset identity に属し、次の field を必須とする。

| Field | Contract |
| --- | --- |
| `arcId` | dataset 内で一意な opaque id。coordinate hash から生成する場合も algorithm revision を dataset identity に含める。 |
| `datasetId` | 親 dataset record の identity。 |
| `classification` | `coastline` または `sharedBorder`。それ以外は契約違反。 |
| `orientation` | canonical coordinate order。ring reference はこの orientation に対する `forward` / `reverse` を持つ。 |
| `coordinates` | canonical WGS84 coordinate sequence。2点未満、非 finite、範囲外座標は拒否する。 |
| `coordinateHash` | coordinate sequence の canonical hash。非 finite coordinate、WGS84 範囲外 coordinate、2点未満は拒否する。 |
| `endpointHash` | endpoint pair の canonical hash。shared-border matching の入力であり、snap 補正の結果ではない。 |
| `ownerPolygonIds` | coastline は1件以上、shared border は原則2件。仕様で例外を定義するまで不足/過剰を成功扱いしない。 |

Arc identity は source polygon の一時的な feature index や vector tile id から導出してはならない。dataset 内で feature order が変わっても同一 topology が同一 identity になる設計を優先するが、そのために曖昧な matching を成功扱いしない。

初期抽出実装は source ring の隣接 edge を検証単位として扱い、同一 ring 上で連続する同一 `classification` / `ownerPolygonIds` の run を1つの arc record に coalesce する。共有境界は逆向きに出現する同一 coordinate sequence を canonical orientation へ正規化して単一 arc として保存し、ring relation は `forward` / `reverse` で参照する。3つ以上の polygon が同一 edge を所有する場合は曖昧な topology として失敗する。

### Ring And Reconstruction Identity

Ring relation は coordinate を複製せず、ordered arc references を保存する。

| Field | Contract |
| --- | --- |
| `ringId` | dataset 内で一意な opaque id。 |
| `datasetId` | 親 dataset record の identity。 |
| `polygonId` | source polygon の canonical identity。feature array index だけを identity にしない。 |
| `role` | `outer` または `inner`。 |
| `arcRefs` | 1件以上の `{ arcId, direction }`。`direction` は `forward` / `reverse`。 |
| `closed` | canonical validation result。未閉路を補正して `true` にしない。 |
| `orientation` | ring orientation。向き不一致は reconstruction error として扱う。 |

Polygon reconstruction relation は source polygon と ring set の対応を保存する。`polygonId`、`datasetId`、outer ring、inner rings、source feature lineage、output artifact identity を必須とし、欠落時は reconstruction を開始しない。

## Ownership And Lineage

Border geometry storage の lineage は次の順序を正とする。

```text
selection meta
  -> source artifact
  -> border geometry dataset
  -> arc records
  -> ring / polygon reconstruction relations
  -> reconstructed geometry artifact
  -> tileEmit artifact
```

`source` / `geometry` / `tileEmit` の既存 lineage は維持する。border geometry path を有効化する後続 issue は、新規 feature flag が off のときに既存 lineage を変更してはならない。

Cleanup は node ownership を検証してから下流 artifact へ cascade する。別 node の dataset、arc、ring、polygon relation を参照する場合は契約違反として失敗し、削除対象の推測や cross-node fallback を行わない。

## Contract Violations

次の状態は即時に visible error とする。

- 必須 identity field の欠落、空文字、非 canonical 値
- `nodeId` または `datasetId` の ownership 不一致
- 非 finite coordinate、WGS84 範囲外 coordinate、2点未満 arc
- 3つ以上の polygon が同一 border edge を共有する曖昧な topology
- `classification`、`orientation`、`role`、`direction` の未知値
- coastline / shared-border owner polygon cardinality の不一致
- open ring、orientation mismatch、arc reference 欠落
- dataset revision と source artifact lineage の不一致
- 既存 `geometryCache` / `tileEmitBufferRelations` / vector tile output から topology relation を復元しようとする reader path

契約違反を clamp、snap、default 補完、legacy record fallback、stale cache reuse で成功扱いしてはならない。

## Feature Flag And Migration

Storage implementation は default-off feature flag 配下で導入する。flag off では次を満たすこと。

- 新規 border geometry reader / writer を呼ばない。
- 既存 source / geometry / tileEmit record の identity、cleanup、resume behavior を変更しない。
- 新規 schema が存在しても既存 build の成功条件に影響させない。

初期実装の feature flag 名は `HDB_SHAPE_BORDER_GEOMETRY_STORAGE` とする。`ShapeDB` の Dexie v3 schema は次の table を border geometry storage 専用に所有する。

| Table | Root identity |
| --- | --- |
| `borderGeometryDatasets` | `datasetId` |
| `borderGeometryArcs` | `[datasetId+arcId]` |
| `borderGeometryRings` | `[datasetId+ringId]` |
| `borderGeometryPolygonRelations` | `[datasetId+polygonId]` |
| `borderSpatialIndexes` | `[datasetId+indexId]` |

永続 schema を追加する issue は、migration / recovery / non-reversible operation の扱いをその issue 本文と PR に明記する。rollback は flag off と対象 border geometry artifact の破棄を基本とし、既存 cache identity の再解釈を rollback 手段にしない。

## Follow-up Issue Contracts

- #1481 は本仕様の dataset / arc / ring identity を前提に spatial index と containment query boundary を定義する。
- #1482 は本仕様を実装契約として参照し、default-off flag 配下で storage schema と validation を追加する。
- #1483 以降は arc identity、owner polygon relation、ring/reconstruction relation を変更する場合、本仕様を同じ PR で更新する。
