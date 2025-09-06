# feat(route/ui): add live progress bar alongside summary in Panel

## Why
- 進捗のライブ可視化（10Hz 合流のスナップショット）と、Dexie ベースの概要（cursor/results）の両方を提供したい

## Scope
- 追加: RouteBatchLiveProgress（useRouteBatchProgress 利用）
- Panel: Live バー + Summary の併記

## Changes
- packages/node-type/route-plugin/src/ui/components/RouteBatchLiveProgress.tsx
- packages/node-type/route-plugin/src/components/RoutePanel.tsx

## Testing
- typecheck OK
- ローカルでジョブ起動 → ライブバーが更新され、Summary と整合

## Rollback
- Panel の Live バー部分のみを差し戻し可
