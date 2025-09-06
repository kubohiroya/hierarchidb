# feat(route/ui): OSRM/throttle settings save and defaults

## Why
- OSRM Base URL/プロファイル、RPS/並列の既定値を環境/ユーザ設定から再現性高く扱いたい

## Scope
- env/defaults: localStorage > global > env の優先度で既定を読み込み
- LaunchForm: Save ボタンで HIDB_OSRM_* を保存

## Changes
- packages/node-type/route-plugin/src/services/config/osrm-defaults.ts
- packages/node-type/route-plugin/src/ui/components/RouteBatchLaunchForm.tsx

## Testing
- typecheck OK
- Save → Reload で値が復元されること

## Rollback
- 保存処理と defaults のみ。差し戻し容易
