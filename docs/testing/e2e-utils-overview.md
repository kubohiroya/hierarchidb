# E2E / 結合テスト共通ユーティリティ運用ノート

このドキュメントは、Playwright ベースの E2E テストおよび runtime-worker 結合テスト（WFL/headless）が共有しているユーティリティとその検証方法を、テスト作成者・レビュー担当向けにまとめたものです。

## 1. Playwright 向けユーティリティ

パス: `e2e/utils/test-helpers.ts`

### 主な提供機能
- ベース URL の組み立て（ブラウザルーター/ハッシュルーター両対応） `buildAppUrl`
- URL契約のSSOT `e2e/utils/e2e-url-contract.ts`
  - `PLAYWRIGHT_BASE_URL` 未指定時は `VITE_APP_NAME` / `PLAYWRIGHT_APP_NAME` / 既定
    `hierarchidb` から production preview と同じ base path を決める。
  - `playwright.config.ts`、`e2e/global-setup.ts`、spec helper はこの契約を共有し、spec から
    `localhost:<port>` や root `/` へ直接遷移しない。
- ガイドツアー解消・TreeTable/Working Copy 待機・Undo/Redo 操作などの UI 操作ヘルパー
- SpeedDial を介したフォルダ CRUD、ドラッグ＆ドロップ、Archive 復旧といった主要動線の共通化
- シナリオ別データ初期化 `setupTestData`、アニメーション待機、スクリーンショット・コンソール追跡

### 実動での検証
- 代表例: `e2e/cp-routing-wc-flow.spec.ts`
  - CRUD/Drag & Drop/Working Copy 同期など、提供関数を組み合わせて 1 シナリオを構成。
- その他 `e2e/folder/…`, `e2e/route/…`, `e2e/treetable/…` でも同ヘルパーを import して共通操作を共有。

> Playwright スイート全体がこのファイルに依存しているため、ヘルパーが期待通り動作しない場合はシナリオ自体が失敗します。

### 実行制御
- `e2e/utils/skip-if-disabled.ts` で `HIERARCHIDB_E2E=1` が未指定なら `test.skip` を実行。CI／ローカルでの切替を容易にします。
- ルートの `pnpm e2e` は決定論的な既定スイートとして Chromium project のみを `--workers=1` で実行します。
  Firefox は `pnpm e2e:firefox`、全 Playwright project は `pnpm e2e:all` で明示実行します。

## 2. Worker 結合テスト向けユーティリティ

フラグ制御を前提にしたユーティリティ（`worker-flag-helpers.ts`）は 2025-10-25 のフラグ廃止に伴い削除済みです。WFL/Playwright 双方とも、現在はデフォルト構成（CommandProcessor ルーティング常時有効）で動作検証を行います。

### 共通エントリ
- `packages/runtime/worker/src/e2e/test-worker.entry.ts` — Fake IndexedDB + Comlink をサンドボックスに露出し、全 WFL から同一の `WorkerService` API を利用。

## 3. グローバルなテストセットアップ

パス: `vitest.setup.base.ts`

### 主な提供機能
- Comlink, Worker, fetch, structuredClone 等の Node ポリフィル
- IndexedDB 全削除ヘルパー `clearAllDatabases()`
- `setupBasicTestEnvironment()` による `beforeEach` 登録（DB クリーン + モック reset）

### 実動での検証
- すべての runtime-worker / headless テストがこの設定を取り込んで実行。
- DB リセットやモッククリアが機能しないと既存シナリオが不安定になるため、基盤が常時検証される。

## 4. MapLibre preview と headless Chromium

MapLibre preview を含む Playwright E2E は、route/location/shape など個別プラグインの責務ではなく、Playwright の Chromium project 設定で WebGL 初期化条件を固定する。

- `playwright.config.ts` の Chromium project は SwiftShader WebGL を明示する launch args を持つ。
- MapLibre preview 到達時の `Failed to initialize WebGL` / `webglcontextcreationerror` は、通常の E2E では未許可の console error として扱う。
- 環境制約により WebGL unavailable を意図的に許容する場合は、対象 spec または helper で理由と許容メッセージ範囲を明示する。route/location canonical flow の fixture や Step2-Step6 の責務に混ぜない。

## 5. Firefox 起動確認

Playwright の `firefox` project が `--project=firefox` で明示選択された場合、global setup はテスト本体の前に短い Firefox launch probe を実行する。起動に失敗した場合は、アプリ assertion やURL契約の失敗と混ぜず、環境/ブラウザ起動障害として fail-fast する。`pnpm e2e` の既定対象は Chromium のため、Firefox 起動可否は `pnpm e2e:firefox` または `pnpm e2e:all` の opt-in 検証として分離する。suite 成功扱いにするための skip、retry、fallback、過剰 timeout は追加しない。

## 6. 期待動作のレビュー観点

- **新しい Playwright シナリオを追加する場合**: 既存ヘルパーで解決できない UI 操作かどうかを確認し、汎用化できるコードは `test-helpers.ts` に追加。履歴としてこの文書と対象 GitHub Issue に整備方針を追記すると良い。
- **環境依存エラーが疑われる場合**: `skip-if-disabled.ts` の判定や `test-helpers.ts` 中の `addInitScript` など初期化ロジックを確認。WFL で再現するかどうかを切り分ける。

## 7. 参考リンク
- Playwright ガイド: `docs/testing/cp-routing-wc-playwright.md`
- runtime-worker WFL ガイド: `docs/testing/runtime-worker-wfl.md`
- ResolverDialog headless テストメモ: `docs/testing/resolver-dialog-headless-e2e.md`
- Vitest ランタイムメモ: `docs/testing/vitest-runtime.md`

---

ユーティリティの挙動は個別ユニットテストではなく「それを使用する統合シナリオの成功」で常時検証されています。 新規テストを追加する場合は、既存ユーティリティの再利用可否と副作用（フラグ・DB 初期化など）を必ず確認し、必要ならこの文書に注意点を追記してください。
