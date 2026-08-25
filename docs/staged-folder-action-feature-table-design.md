# Preview / Map UI Feature Table Design Split

Issue: #1611

## Purpose

Preview / Map UI feature table を read-only table と dependency-aware editable table に分けて設計する。現状の表示機能を壊さず、後続実装で editable cell から plugin-owned entity field、dependency lifecycle、incremental rebuild plan へ接続する境界を固定する。

この文書は実装 Issue へ分割するための design doc であり、UI が dependency store、copy-on-write data、plugin-owned Dexie/IndexedDB entity を独自に推測して更新することを禁止する。

## Current Read-Only Responsibility

現状の read-only feature table は以下を担当する。

| Surface | 現状責務 | 主な実装 |
| --- | --- | --- |
| Preview step feature table | shape/location/route feature row の一覧、検索、選択、status/error 表示 | `packages/ui/map/src/preview/ShapePreviewList.tsx`, `packages/ui/map/src/preview/RoutePreviewList.tsx`, `packages/ui/map/src/preview/LocationPreviewList.tsx` |
| Map UI floating table | map route 上の feature row 一覧、viewport/search filter、選択状態、window/persisted table state | `app/src/router/routes/modeless/modelessDialogContent.tsx`, `app/src/router/routes/modeless/modelessDialogContentData.ts` |
| Shared floating table | column selector、sort/grouping/visibility/sizing、status/error columns、toolbar actions | `packages/ui/map/src/preview/MapPreviewFloatingTable.tsx` |
| Generic grid substrate | row/cell rendering、selection、sort/grouping、primitive `column.editable` / `onCellEdit` input lifecycle | `packages/ui/data-grid/src/TanstackDataGrid.tsx` |

現状 table は row display surface としては利用できるが、feature row がどの source entity field へ write されるかを保持していない。`column.editable` は generic input hook であり、dependency-aware write contract ではない。

## Read-Only Boundary

read-only table は以下を行ってよい。

- feature row の display value を表示する。
- search、sort、grouping、selection、column visibility/sizing を管理する。
- status/error summary、transform error、recycling indicator、metadata dialog を表示する。
- map selection と table selection を同期する。

read-only table は以下を行ってはならない。

- display row から plugin-owned entity field を推測して Dexie/IndexedDB へ直接書き込む。
- derived display value を editable source field として扱う。
- dependency status が未取得の状態を `active`、`none`、`build-not-required` などへ補完する。
- copy-on-write `data` / `patchData` / mount record / artifact output を UI 側で独自に解決する。

## Editable Source Field vs Derived Display Column

editable source field は、plugin adapter が write target と parser/validator を明示できる field だけである。derived display column は、表示または artifact 由来の値であり、source write target を持たない。

| Entity | Editable source field candidate | Derived display column |
| --- | --- | --- |
| location | `name`, `lon`, `lat`, administrative metadata, shape membership reference | centroid-derived value, resolved route endpoint label, display-only aggregate labels |
| route | `name`, `mode`, endpoint location reference, waypoint reference/order | distance, resolved endpoint admin label, derived geometry, waypoint count derived from geometry |
| shape | name/admin metadata, style/display metadata where plugin adapter exposes a write target | bbox, area, vertex count, polygon count, built vector tile geometry |

`source.fieldPath` は write target であり、derived display column には設定してはならない。derived value を再 import 可能な source field のように扱うことは禁止する。

## Write Target Contract

dependency-aware editable column は少なくとも以下の metadata を持つ。

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

`FeatureCellEditRequest` は UI から Worker/plugin service へ渡す command input であり、UI 内で永続化してはならない。

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

成功結果は、更新後の source version、affected dependency edge IDs、created rebuild plan ID、UI refresh hint を返す。失敗結果は typed error とし、grid は edited value を commit 済みに見せてはならない。

## Dependency-Aware Edit Flow

1. User が editable cell を開始する。
2. UI は column metadata、current value、field-level dependency status を service から取得する。
3. User が値を変更して commit する。
4. `MapPreviewFloatingTable` は `FeatureCellEditRequest` を作るだけに留める。
5. plugin adapter が parse / validation を行う。
6. dependency edit service が dependency index を逆引きし、impact summary と rebuild plan を作る。
7. 影響がない場合は plugin service が source field を transactionally update し、UI refresh hint を返す。
8. `active` artifact input に影響する場合は、source update、edge stale marking、incremental rebuild enqueue を同一 command として実行する。
9. `pending-reference` は warning 付きで edit を許可できるが、build/capture/export の失敗可能性を result に残す。
10. `rebuilding` は初期実装では read-only とする。
11. `orphaned` は通常 edit を開始せず diagnostics / repair flow に誘導する。

## UI Boundary

Preview table、Map UI floating table、map feature popover は同じ source mapping と dependency query を使う。map feature popover 用の別編集経路を作ってはならない。popover の edit menu は対象 feature row を選択し、同じ `FeatureCellEditRequest` flow に入る。

`TanstackDataGrid` の `column.editable` / `onCellEdit` は input lifecycle のみ担当する。dependency status の解決、approval requirement、transactional write、stale propagation、incremental rebuild enqueue は Worker/plugin service 側で行う。

## Implementation Issue Split

| Issue | Scope | DoD | Rollback |
| --- | --- | --- | --- |
| DataGrid edit substrate | `TanstackDataGrid` に async edit lifecycle、pending/failed/dirty visual state、cancel/rollback hook を追加 | edit success/failure/cancel が unit test で固定される | grid editable feature flag を OFF |
| Feature table edit contract | `MapPreviewFloatingTable` に editable column metadata と `FeatureCellEditRequest` emit を追加 | UI が request を作るだけで直接 write しないことを test する | editable column metadata を渡さない |
| Dependency edit service | dependency index から impact summary、approval requirement、stale transition、rebuild plan を計算 | active/stale/rebuilding/orphaned/pending-reference の分岐 test | service registration を外す |
| Plugin preview adapters | shape/location/route の editable field mapping と parser/validator を定義 | derived column に source mapping が付かないことを test | adapter editable field list を空にする |
| Map popover integration | map feature click/popover を feature table と同じ edit flow へ接続 | popover が独自 write しないことを interaction test | popover edit menu を非表示 |
| End-to-end UI tests | Preview / Map UI から edit、stale propagation、incremental rebuild enqueue、rollback を確認 | service-level + UI interaction test が通る | editable feature flag を OFF |

## Verification

Design doc only:

- `git diff --check`
