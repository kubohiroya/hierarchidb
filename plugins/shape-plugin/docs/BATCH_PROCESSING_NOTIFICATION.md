# ビルドセッション通知

## 目的

Shape Plugin のビルド状態は、Worker が配信する canonical 4-event contract を通じて UI の SSOT 状態木へ反映する。本書は、build session 内部の更新通知と Worker→UI イベントの責務境界を定義する。

正規仕様は次の文書とし、本書は Shape 固有の接続方法だけを補足する。

- `docs/build-session-spec.md`
- `docs/build-session-worker-ui-event-spec.md`
- `docs/build-session-worker-ui-event-design.md`

## 責務境界

```text
AbstractBuildSession
  └─ payload を持たない session update 通知
       └─ BaseBuildSessionManager
            └─ CanonicalBuildSessionManager
                 ├─ sessionStatusUpdated
                 ├─ stageSnapshotUpdated
                 ├─ taskProgressUpdated
                 └─ heartbeat
                      └─ Shape UI SSOT 状態木
```

`AbstractBuildSession` は `BuildProgressEvent` を生成しない。状態または内部の task count が変化したとき、`addSessionUpdateListener` で登録された listener をpayloadなしで呼び出す。通知を受けた manager は session の `getState()` と `CanonicalBuildSessionEventSource` を読み直し、正規イベントを生成する。

session update 通知は transport event ではなく、同一ランタイム内の再読込トリガーである。task count、phase、stage、時刻を通知payloadへ複製してはならない。

## Canonical 4イベント

| チャネル | イベント | 所有する情報 |
| --- | --- | --- |
| `session-state` | `sessionStatusUpdated` | lifecycle phase、active状態、session timing、current stage |
| `stage-snapshot` | `stageSnapshotUpdated` | stage単位のauthoritative task全置換とstage timing |
| `task-progress` | `taskProgressUpdated` | taskId単位のversion付き進捗 |
| `heartbeat` | `heartbeat` | active sessionのliveness時刻 |

task countとpercentageはauthoritative stage snapshot/task stateから導出する。`sessionStatusUpdated`から件数ゼロのaggregate progressを生成しない。

## Shape Worker API

Shape UI は `BuildWorkerBridge.subscribeAll` でcanonical 4チャネルを購読する。Worker診断ログは正規状態とは独立して `subscribeWorkerLog` から購読し、SSOT状態木へreducer入力として渡さない。

Shape の `startBuildSession` はprogress callbackを受け取らない。旧`subscribeProgress`とcallback registryも公開・保持しない。テストハーネスがtask状態を確認する場合は、目的に応じて`subscribeStageSnapshots`、`subscribeTaskProgress`、`subscribeSessionState`、`subscribeSessionHeartbeat`を使用する。

Route と Location は現在managerとUI consumerが同じUI realmに存在するため、`unconditionalEventStreamer`のsame-realm transportを使用する。Worker transportへの暗黙fallbackは行わない。

## 配信規則

- manager/orchestratorはsession実行前にsessionを登録する。
- session updateごとにcanonical sourceを読み、session state、未配信task progress、authoritative stage snapshotを配信する。
- byte-equivalentなsession statusとstage snapshotはmanagerが抑制してよい。
- task progressのversionはtaskId単位で単調増加させる。global event versionを作らない。
- heartbeatはactive sessionだけで配信し、phaseやtask情報を含めない。
- session終了時はlistener、heartbeat timer、managerのsnapshot fingerprintを解放する。

## 契約違反

以下は即時に失敗させる。

- progressがfiniteな`0..100`でない。
- `updateProgress`へ派生値`percentage`を明示指定する。
- task countが非整数、負数、またはterminal countがtotalを超える。
- started stageのtimingが欠落・非finite・負数である。
- lifecycle phaseと`isActive`が一致しない。
- requested nodeIdとsession/statusのnodeIdが一致しない。

clamp、丸め、現在時刻、ゼロ、旧event aliasによる補完は禁止する。回復が必要なlegacy永続行は、正規仕様に定めた明示確認付きrecovery commandだけを使用する。

## UI状態

UIはReact state、ref、module-scope変数にbuild session状態を複製しない。ShapeのJotai状態木を唯一の真実の源とし、初回authoritative stage snapshotが届くまでは`ui-initializing`として扱う。明示的な空snapshotだけが「開始済みstageにtaskが0件」を表す。

## 一時停止・再開

pauseはpipeline Promiseのsettleを確認してから`paused`を永続化する。停止確認前にrunning taskをqueuedへ戻さない。timeoutはtyped errorと`failed`で可視化し、`paused`や再開可能状態へ読み替えない。

Start（UI上の旧Resumeラベルを含む）は`startBuildSession`の単一入口を使用する。canonical event購読はcommand APIではなく、状態観測だけを担当する。

## 禁止される旧経路

- `BuildProgressEvent` callbackをsession開始引数へ渡すこと。
- `subscribeProgress`でaggregate progressを購読すること。
- `progressCallbacks` registryを保持すること。
- aggregate eventからcanonical task eventを推測すること。
- `download / extract1 / extract2 / vectorTiles`をcanonical stage IDとして使用すること。

canonical stage IDは`source / geometry / tileEmit`である。
