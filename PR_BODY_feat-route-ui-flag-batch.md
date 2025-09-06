# feat(route/ui): feature flag gating (ROUTE_BATCH_ENABLED)

## Why
- Batch UI を既定OFF/ONで段階導入し、リスクを最小化

## Scope
- isFlagEnabled(localStorage/env/global) で ROUTE_BATCH_ENABLED を判定
- Panel の Batch セクション表示をフラグで制御（デフォルト true）

## Changes
- packages/node-type/route-plugin/src/services/config/flags.ts
- packages/node-type/route-plugin/src/components/RoutePanel.tsx

## Testing
- localStorage.setItem('ROUTE_BATCH_ENABLED','false') → 非表示
- 'true' に戻すと表示

## Rollback
- フラグ判定呼び出しを削除すれば元に戻る
