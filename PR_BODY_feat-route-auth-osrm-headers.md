# feat(route/auth): OSRM engine supports headers and 401/403 auth notification hook

## Why
- OSRM 呼び出し時に Authorization 等のヘッダ注入が必要なケースに対応
- 401/403 発生時に AuthRecovery（共通通知）へフックしてユーザ復帰導線を整える（土台）

## Scope
- OsrmEngine: options.headers を許可し net.port に透過
- 401/403 応答時にグローバル AuthNotificationRegistry をベストエフォートで呼び出し（存在すれば）

## Changes
- packages/node-type/route-plugin/src/services/engines/OsrmEngine.ts

## Testing
- typecheck OK
- 開発環境で headers: { Authorization: 'Bearer ...' } を渡して呼び出し確認

## Rollback
- OsrmEngine への変更のみ。リバートで即時復帰可能
