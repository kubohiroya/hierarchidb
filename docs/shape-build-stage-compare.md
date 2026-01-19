# Shape build stage comparison (current vs new)

This document compares the current pipeline to the target flow by stage.

## Scope

- Current: fetch -> transform -> vt. Fetch is primarily retrieval, transform is heavy pre-processing, vt builds tiles from collections.
- Target: fetch -> transform -> vt. Fetch includes filtering and band thinning, transform does simplify and inverted indexing, vt generates tiles via the inverted index.

## Per-stage differences

| Aspect | Current fetch | Target fetch |
| --- | --- | --- |
| Input | Data source URL and selection filters | Same |
| Processing | Fetch and basic filter | Filter plus band thinning from high zoom to low zoom |
| Output | fetchCache FlatGeobuf | Per feature per zoom band FlatGeobuf |
| Storage | `EphemeralShapeDB.fetchCache` | `EphemeralShapeDB.fetchBandFeatures` |
| Benefit | Simple processing | Downstream processing is lighter and band reuse is possible |
| Risk | Transform cost spikes | Fetch computes and stores more |

| Aspect | Current transform | Target transform |
| --- | --- | --- |
| Input | fetchCache FlatGeobuf | Per feature per zoom band FlatGeobuf |
| Processing | Quantization-heavy preprocessing plus simplify and tile relations | Simplify only plus inverted index creation |
| Output | transformCache FlatGeobuf plus tileIdToBufferRelations | transformBandFeatures FlatGeobuf plus inverted index |
| Storage | `EphemeralShapeDB.transformCache` / `EphemeralShapeDB.tileIdToBufferRelations` | `EphemeralShapeDB.transformBandFeatures` + `ShapeDB.invertedIndex` |
| Benefit | Intermediate results are reusable | Processing is simpler and tile generation is faster |
| Risk | Complex preprocessing with more failure modes | Index design matters and persistent storage grows |

| Aspect | Current vt | Target vt |
| --- | --- | --- |
| Input | Aggregate transformCache per tile | Use inverted index to select features for each tile |
| Processing | geojson-vt to vt-pbf | geojson-vt to vt-pbf with parent, child, and grandchild tiles |
| Output | vtTiles PBF | vtTiles PBF |
| Storage | `ShapeDB.vectorTiles` | `ShapeDB.vectorTiles` |
| Benefit | Existing implementation is stable | Tile selection is faster and reproducible |
| Risk | Tile generation re-scans broad areas | Missing index entries cause tile gaps |

## Overall summary

- Fetch is strengthened and transform is simplified.
- Intermediate artifacts are kept in EphemeralShapeDB, while inverted indexes and tiles live in ShapeDB.
- VT narrows tiles via the inverted index and generates parent, child, and grandchild tiles.
