# SharedWorker + Web Locks + BroadcastChannel による WorkerAPI 再編

この ExecPlan は living document であり、`Progress` / `Surprises & Discoveries` / `Decision Log` / `Outcomes & Retrospective` を作業の進行に合わせて更新し続ける。

PLANS.md はリポジトリ直下の `PLANS.md` に存在する。本ドキュメントはその規約に従って保守する。

## Purpose / Big Picture

複数タブでアプリを開いたときに、WorkerAPI がタブごとに乱立せず、Web Locks で「実行タブ」を一本化しつつ、SharedWorker を Comlink で公開する構成へ移行する。ビルドセッションの「タブ超えの存在・動作状況通知」は BroadcastChannel を使って軽量に同期し、重要なイベント通知（ステージ/完了/エラー等）は既存どおり Comlink callback の pub/sub を維持する。これにより、単一タブ運用では Dedicated Worker を維持しつつ、複数タブ運用でも「どのタブが実行中か」「他タブの進行状況」を正しく把握できるようになる。

## Progress

- [x] (2026-02-08 10:00 JST) TASKS.md にタスクを追加し、着手ログを記載した。
- [x] (2026-02-08 10:20 JST) 既存の WorkerAPI 初期化経路と BuildSession の Broadcast 経路を調査し、影響箇所の一覧を作成した。
- [x] (2026-02-08 10:35 JST) SharedWorker エントリと Dedicated Worker エントリの共通 bootstrap を追加し、SharedWorker 初期化時に Web Locks を使う下地を実装した。
- [x] (2026-02-08 10:40 JST) WorkerClient を SharedWorker 優先に再編し、Dedicated Worker フォールバックを維持した。
- [x] (2026-02-08 10:45 JST) BroadcastChannel を `packages/session-coordinator` のヘルパーに統合し、build session 通知を移行した。
- [x] (2026-02-09 09:31 JST) typecheck を実行し、結果を TASKS.md に記録した。

## Surprises & Discoveries

- Observation: `pnpm build` で `@hierarchidb/app` の Vite build が `NodeId` の missing export で失敗する。
  Evidence: `packages/shape-api/dist/index.js` が `@hierarchidb/core-types/dist/index.js` から `NodeId` を import しており、`MISSING_EXPORT` が発生。
- Observation: `@hierarchidb/core-types` を tsc build に切り替えても、`shape-api` の runtime import が残っているためエラーが継続する。
  Evidence: `packages/shape-api/dist/index.js` 先頭が `import { NodeId } from "@hierarchidb/core-types";` のまま。
- Observation: `shape-api` を tsc build に切り替えると `NodeId` の runtime import が消え、`pnpm build` が通る。
  Evidence: `packages/shape-api/dist/index.js` の先頭が `export { DEFAULT_BUILD_CONFIG } from './defaults.js';` になり、`pnpm build` が exit 0。

## Decision Log

- Decision: SharedWorker が利用可能な場合は常に SharedWorker を利用し、SharedWorker 非対応環境では Dedicated Worker にフォールバックする。UI での切替は実装しない。
  Rationale: SharedWorker のオーバーヘッドは小さく、複数タブでのメモリ共有と初期化コスト削減の利点が大きい。UI での選択は運用負担を増やすため採用しない。
  Date/Author: 2026-02-08 / Codex

- Decision: Web Locks のロックキーは固定値を採用する。
  Rationale: Worker インスタンスの「アプリ全体で 1 つ」という要件と一致し、衝突回避のためにキーを分散する必要がないため。
  Date/Author: 2026-02-08 / Codex

- Decision: SharedWorker 初期化時に `navigator.locks` の排他ロックを取得し、初期化実行を一本化する。
  Rationale: SharedWorker での初期化が並走しないことを保証し、タブ跨ぎシングルトン要件を明示的に担保するため。
  Date/Author: 2026-02-08 / Codex

## Outcomes & Retrospective

- （完了時に記載）

## Context and Orientation

本リポジトリは UI 側から Dedicated Worker を Comlink でラップして `WorkerAPI` を利用している。現状の Dedicated Worker エントリは `app/src/worker-runtime/worker.ts`、UI 側クライアント生成は `app/src/worker-runtime/client.ts`、初期化管理は `app/src/worker-runtime/WorkerAPIClient.ts` と `app/src/worker-runtime/WorkerStateStore.ts` に集約されている。ビルドセッションの状態一覧は `WorkerAPI.subscribeBuildSessionRecordsByStatus` を通して取得しており、Worker からの更新トリガは `packages/runtime-worker/src/services/buildSessionBroadcast.ts` の BroadcastChannel を使っている。一方で、タブ間のハートビートや Web Locks の補助機構は `packages/session-coordinator/src/index.ts` と `packages/ui/session-coordinator/src/SessionCoordinatorProvider.tsx` に実装されている。

今回の変更では以下の二つを同時に再編する。

1) WorkerAPI 初期化・接続経路
- SharedWorker を Comlink で expose し、UI 側は SharedWorker 接続を優先する。
- Web Locks を用いて SharedWorker の初期化と “実行タブ” を一本化する。
- SharedWorker 非対応環境は Dedicated Worker を利用する。

2) ビルドセッションのタブ超え通知
- 重要なイベント（ステージ/完了/エラーなど）は Comlink callback を維持する。
- タブを跨いだ「存在・動作状況通知」は BroadcastChannel を使用し、`packages/session-coordinator` の既存設計（heartbeat / isRunnerTab）に統合する。

用語定義:
- SharedWorker: タブ間で共有される Worker。複数タブが MessagePort を介して 1 つの Worker に接続する。
- Dedicated Worker: タブごとに生成される Worker。
- Web Locks: `navigator.locks` による排他制御。ここでは Worker のシングルトン化と実行タブ判定に使う。
- BroadcastChannel: 同一オリジンのタブ間で通知を送るブラウザ API。ここではビルドセッションの“存在/動作状況”通知に限定する。

## Plan of Work

まず `app/src/worker-runtime/client.ts` を分割し、SharedWorker 接続に必要なラッパを新設する。SharedWorker の場合は `SharedWorker` の `port` を Comlink でラップし、`MessagePort` に対する `postMessage` / `addEventListener` を使って初期化メッセージを流す必要がある。Dedicated Worker では現行の `worker.ts?worker&url` を維持する。これに合わせて `WorkerInitializationChannel` と `WorkerInitializationReporter` が `Worker | MessagePort` の双方を扱えるように拡張し、初期化イベントの送受信先を抽象化する。

次に `WorkerAPIClient` と `WorkerStateStore` を SharedWorker 対応のクライアント取得 API に寄せる。`WorkerAPIClient.getOrInit()` の内部で「SharedWorker が使えるなら SharedWorker を優先」するロジックに置き換え、Dedicated Worker でしか利用できない API を分離する。`getRawWorkerInstance` は `Worker | MessagePort` を返すよう拡張し、初期化チャネルが同じ手順で完了判定できるようにする。

次に `WorkerProvider`（`app/src/contexts/WorkerProvider.tsx`）と `WorkerClientProxy` を更新し、SharedWorker 接続を前提とした初期化・再接続フローに合わせる。UI 側からは `WorkerAPIClient` の契約が変わらないようにしつつ、内部で `SharedWorker | Dedicated Worker` を選択する。`__HDB_WORKER_CLIENT_REF__` の扱いは維持する。

次に Worker 側エントリを SharedWorker でも動くように調整する。`app/src/worker-runtime/worker.ts` は Dedicated Worker の `self` 前提なので、SharedWorker 用のエントリを別ファイルとして用意する（例: `app/src/worker-runtime/shared-worker.ts`）。SharedWorker の `onconnect` で MessagePort を取得し、Comlink.expose で API を公開する。

ビルドセッションの通知は `packages/runtime-worker/src/services/buildSessionBroadcast.ts` を再設計する。`packages/session-coordinator` の BroadcastChannel helper を使い、タブ超えの「存在/動作状況」通知のみを送る。`subscribeBuildSessionRecordsByStatus` の refresh トリガはこの BroadcastChannel を使い続けるが、payload の定義を `session-coordinator` と一致させる。TreeSubscriptionAPI など重要通知は Comlink callback のまま。

## Concrete Steps

1. `app/src/worker-runtime/client.ts` を SharedWorker 対応に分割し、Dedicated Worker 生成と SharedWorker 接続の両経路を持つようにする。Dedicated Worker 向けの URL 解決は現状維持。

2. `packages/ui/worker-client/src/WorkerInitializationChannel.ts` と `packages/ui/worker-client/src/WorkerInitializationReporter.ts` に `MessagePort` 受信口の対応を追加する。`WorkerInitConfig.worker` を `Worker | MessagePort` に拡張し、MessagePort の場合は `postMessage` と `addEventListener` を port に対して行う。

3. `app/src/worker-runtime/WorkerAPIClient.ts` を SharedWorker でのクライアント取得に対応させる。`getRawWorkerInstance` は `Worker | MessagePort` を返すよう拡張し、初期化チャネルで共通に扱えるようにする。

4. SharedWorker のエントリファイルを新設し、`Comlink.expose` が `MessagePort` を `Comlink.expose(api, endpoint)` で公開する構成にする。Dedicated Worker では現行 `worker.ts` を維持する。

5. `packages/runtime-worker/src/services/buildSessionBroadcast.ts` の BroadcastChannel 実装を `packages/session-coordinator` の helper に置換し、build session のタブ超え通知を統合する。

6. 影響範囲の typecheck を `pnpm -w turbo run typecheck --filter @hierarchidb/app --filter @hierarchidb/runtime-worker --filter @hierarchidb/ui-worker-client --filter @hierarchidb/session-coordinator` で実行し、結果を TASKS.md に記録する。

## Validation and Acceptance

- ブラウザを 2 タブ開いた状態でアプリを起動し、Worker 初期化が 1 回だけ走ること（2 タブ目が接続待ち/共有接続になること）をログで確認できること。
- 片方のタブで build を開始し、もう片方のタブでもビルドセッションが表示されること（BroadcastChannel での通知）。
- TreeSubscriptionAPI 等の Comlink callback による通知が引き続き動作すること。
- SharedWorker 非対応環境で Dedicated Worker が起動できること。

## Idempotence and Recovery

- 同じ手順を繰り返し実行しても副作用が増えない構成にする。
- ロールバックは `git revert` で該当差分を戻す。Dedicated Worker + 既存 Broadcast 実装に戻れば従来挙動に復帰する。

## Artifacts and Notes

- 作業中に得られたログや diff の要点を短く記載する。

## Interfaces and Dependencies

- `WorkerInitializationChannel` は `Worker | MessagePort` の双方を扱えること。
- SharedWorker エントリは `Comlink.expose(api, endpoint)` を利用し、Dedicated Worker は既存の `Comlink.expose(api)` を維持すること。
- BroadcastChannel の通知 payload は `packages/session-coordinator` の helper に合わせ、`useBuildSessionSnapshots` が最小限の更新トリガとして扱えること。

## Change Note

- 2026-02-08: 初版作成。SharedWorker 優先 / Dedicated フォールバック方針を反映。
