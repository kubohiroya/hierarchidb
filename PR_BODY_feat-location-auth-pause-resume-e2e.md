# feat(location): auth-required の可視化と 401 E2E モック

## 概要
- location-plugin に認証待ち（401/403）発生時の一時停止/再開の可視化を追加。
- 共通通知基盤（@hierarchidb/common-auth + @hierarchidb/auth-recovery）を購読し、
  - onAuthRequired → 進捗イベント `stage: 'auth-required'` をUIに通知
  - onAuthSuccess → `stage: 'resumed'`
  - onAuthCancelled → `stage: 'cancelled'`
- BatchProgressDialog に警告バナーを追加（認証待ち時に表示）。
- 401 のE2Eモック（Playwright）を追加（現状はアプリ側導線の結線待ちのため skip 指定）。
- ヘッドレス検証（Vitest）を追加：通知→フックの進捗変化を確認。

## 変更点
- location
  - hooks/useLocationProgress.ts
    - AuthNotificationRegistry を購読し、auth-required/resumed/cancelled を ProgressEvent で反映
  - components/batch/BatchProgressDialog.tsx
    - useLocationProgress を利用し、`auth-required` で警告バナー表示
  - services/tiles/LocationVectorTileService.ts（流用）
  - hooks/__tests__/useLocationProgress.auth.test.ts（新規）
  - package.json: common-auth 依存追加 / `test` スクリプト追加
- e2e
  - e2e/location-auth-required.spec.ts（Playwright; Nominatim を 401 でモック。現状 skip）

## 実行方法
- 型検証
  - pnpm --filter @hierarchidb/location-plugin typecheck
- ヘッドレステスト（CI/ローカル）
  - pnpm -C packages/node-type/location-plugin test -- --run
- E2E（アプリ結線後）
  - pnpm e2e （または `pnpm e2e -g location-auth-required`）

## フラグ/ロールバック
- 本PRの変更は既定ON（UI表示のみ追加・非破壊）
- 問題時はダイアログ側の利用を差し戻し可能（コンポーネント側ガードで回避）

## スクリーンショット（イメージ）
- 認証待ちのとき、BatchProgressDialog 上部に「🔐 認証が必要です — ...」の警告を表示。

## 付記
- shape-plugin は既に `auth-required` を進捗に載せているため、location とUIの挙動が揃いました。
