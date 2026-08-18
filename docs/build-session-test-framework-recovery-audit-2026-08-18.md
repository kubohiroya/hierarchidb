# BuildSession test framework 回収監査（2026-08-18）

- 関連 Issue: [#1237](https://github.com/kubohiroya/hierarchidb/issues/1237)
- 親監査: [#1235](https://github.com/kubohiroya/hierarchidb/issues/1235)
- 先行して解決する仕様 Issue: [#1127](https://github.com/kubohiroya/hierarchidb/issues/1127)

## 結論

- `origin/feature/test-framework/event-capture-impl` は現在の `main` に全件代替済みであり、cherry-pick や merge の対象にしない。
- `stash@{17}` は完成した回収単位ではない。旧仕様、現行ファイルとの競合、旧配置の UI、固定データ依存 E2E、未完の統合テストが混在するため、apply/pop しない。
- 直接再利用できるコードはない。Step5 のシナリオ名、イベント境界、性能観測項目の一部だけを要件の着想として参照し、現行パス上で書き直す。
- 再開順序は、`#1127` で Worker→UI イベント契約を確定し、現行 shape-plugin に契約テストと Step5 表示テストを追加してから、孤立した `src/test-framework` を削除する順とする。
- `TASKS.md` は廃止済みのため、stash 内の変更を含めて回収しない。タスクの SSOT は GitHub Issues + Project とする。
- 元 branch と stash は本監査では変更・削除しない。監査 PR のマージ後に、別途ユーザー承認を得て掃除する。

## 監査対象

| 対象 | 監査時点の参照 | 説明 |
| --- | --- | --- |
| `main` | `1e1042f03a5649dab10d4e96593901762b4945e1` | 比較基準 |
| abandoned branch | `b51ff36f400bfca2384f515f2bb500547232a658` | `origin/feature/test-framework/event-capture-impl` |
| stash | `d627934d45305c6084ad17794d27efb081b4bda5` | `stash@{17}` |
| stash base | `8d53a622b187cdac8807655d6dac2cbbc66cde4d` | `fix/integration-test/type-errors` 上の WIP |
| stash index parent | `c748a14c394555c1d4c25608367b22c13f240c50` | staged 部分。untracked 用の第3 parent はない |

監査は blob 比較、三点 diff、参照検索、正規仕様との照合で行った。元 branch の checkout、stash の apply/pop、ファイルのコピーは行っていない。

## 規模と包含関係

### Abandoned branch

- `main` に対して 4 commits ahead / 287 commits behind。
- branch の分岐点から 32 files、6,240 insertions。
- 32 files はすべて現在の `main` に存在する。
- 30 files は branch と現在の `main` で blob が同一。
- 差がある 2 files も現在の `main` が後続版である。
  - `.kiro/specs/build-session-comprehensive-test/tasks.md`: 現行側で完了項目が増えている。
  - `src/test-framework/utils/MockUtils.ts`: 現行側で error event helper が追加されている。

したがって branch 全体の disposition は `superseded` である。

### `stash@{17}`

- base との差分は 45 files、8,600 insertions、570 deletions。
- staged 部分は 31 files、8,303 insertions、370 deletions。
- staged 後の worktree 部分は 29 files、920 insertions、823 deletions。
- stash 最終状態の 45 files のうち、19 files は現在の `main` に同名ファイルがあり内容が異なる。26 files は現在の `main` に存在しない。
- `src/test-framework/core/BuildSessionTestFrameworkImpl.integration.test.ts` は index parent では 406 lines あるが、stash 最終状態では空ファイルである。統合テスト完成前の WIP だったことを示す。

### Branch / stash のパス関係

| 区分 | 件数 | 意味 |
| --- | ---: | --- |
| branch-only | 22 | branch で導入されたが stash では変更されていない |
| common | 10 | branch 導入後に stash でも変更された |
| stash-only | 35 | stash だけが変更した |

この `common` はパス集合上の共通であり、回収可能性を意味しない。10 files はいずれも現在の `main` に存在し、stash 版とは競合する。

## 現行正規仕様との衝突

| 旧 branch / stash の前提 | 現行の根拠 | 判断 |
| --- | --- | --- |
| `session-state`、`task-progress`、`stage-snapshot`、`worker-log`、`critical-error`、`heartbeat` の6通知 | `docs/build-session-worker-ui-event-spec.md` は `sessionStatusUpdated`、`heartbeat`、`stageSnapshotUpdated`、`taskProgressUpdated` の4イベントを正規化している | 旧型を回収しない |
| session terminal state が `error` | `docs/build-session-spec.md:29` と event spec の payload は `failed` | `failed` に書き直す |
| notification type ごとの gap-free sequence、replay、再接続時の buffer delivery | event spec 内でも `taskProgressUpdated` の per-task version (`:134`, `:143`) と、version gating をしない FIFO (`:292`) が矛盾している。design は `docs/build-session-worker-ui-event-design.md:197` で FIFO を指定している | `#1127` で先に仕様を一意化する。旧 Reconnection/EventBuffer 実装は回収しない |
| 複数 BuildSession の同時実行と相互隔離 | `AGENTS.md:70-73` はタブごとに SSOT 状態木を1つ、nodeId ごとに1セッションと規定する | ScalabilityVerifier の前提を破棄する |
| 自動 recovery、graceful degradation、alternative delivery、fallback | `AGENTS.md:21,56-57` は契約違反の補完、互換 fallback、non-null assertion を禁止する | ErrorHandler/Reconnection の旧 recovery を回収しない |
| mock event、`Math.random()`、timer で Worker 統合を模擬 | 現行 E2E は実 Worker API と明示的な startup outcome を観測する | シミュレーション実装を回収しない |

特に `#1127` の Issue 本文は「taskId/version は payload に存在しない」としている一方、現在の event spec は `taskId/version` と per-task dedup を記載している。同じ spec の Adapter Responsibilities は dedup/version gating を否定しているため、実装着手前に Issue 本文と2つの仕様書を同時に整合させる必要がある。

## 現在の `src/test-framework` の状態

現在の `main` には `src/test-framework` 配下に 45 tracked files が残っている。しかし、次の理由から active test framework とは見なせない。

- リポジトリ内の他パスから `src/test-framework`、`ComprehensiveTestSuite`、`BuildSessionTestFramework` への参照はない。
- root `package.json` にこの framework 専用の test script はない。
- root `vitest.config.ts` の projects は packages/plugins を列挙しており、root の `src/test-framework` を含めない。通常の `pnpm test` はこのテスト群を実行しない。
- `src/test-framework/vitest.config.ts` は専用設定だが、framework ディレクトリから明示実行する必要がある。
- `BuildSessionTestFrameworkImpl.integration.test.ts` は、現行に存在しない `BuildSessionTestFrameworkImpl.ts` を import する。
- 現行コードにも legacy notification、replay、sequence、fallback、`any`、non-null assertion、mock delay が残る。

2026-08-18 に既存 install 済み main worktree で次を診断実行した。

```bash
cd src/test-framework
pnpm exec vitest run --config vitest.config.ts
```

結果は exit 1 だった。

- Test Files: 6 failed / 4 passed（10 files）
- Tests: 5 failed / 194 passed（199 tests）
- Unhandled Errors: 2
- 主な失敗:
  - 欠落した `BuildSessionTestFrameworkImpl.js` の import
  - 2 property test files の parse error
  - ErrorHandler の期待値不一致
  - worker crash event の未検出
  - duration 0 と timeout
  - fast-check の未処理 property failure

これは stash を積み増す根拠ではなく、孤立した旧テスト群を現行 package のテストへ置き換えてから撤去する根拠である。

## 回収判断

### 1. `superseded`: 直接回収しない

- abandoned branch の 32 files 全件。
- stash が変更する、現在の `main` に存在する 19 files。
- `e2e/global-setup.ts`、`e2e/global-teardown.ts`、`playwright.config.ts`、root `package.json` の旧 E2E script。
- `useShapeBuildProgressPanelViewModel.ts` の旧差分。

現行ファイルを正とし、stash 版で上書きしない。

### 2. `conflicting`: コードも設計も回収しない

- `ReconnectionManager*`: replay、再接続、random handshake、buffered delivery が未確定仕様と衝突する。
- `ScalabilityVerifier*`: 複数同時 BuildSession と `any` map を前提にする。
- `PerformanceMonitor*`: `process.memoryUsage()`、interval、実時間しきい値に依存し、ブラウザ/Worker の実計測になっていない。
- `BuildSessionTestFramework*`: 上記コンポーネントを束ね、retry/fallback/複数 session を設定で許可する。
- `EventBufferImpl.unit.test.ts`: gap-free sequence と旧6通知を検証し、現行 event contract と一致しない。
- `packages/components/src/BuildControlCard.tsx` ほか2 files: 現行にない旧 package 配置である。
- `TASKS.md`: 利用廃止済み。
- screenshots 4 files: 一時的な失敗調査 artifact である。

### 3. `concept-only`: 要件の着想だけ利用する

| 着想 | 現行の実装先 | 必要な依存 | 最小検証 |
| --- | --- | --- | --- |
| Step5 empty / receiving / task-list / terminal 表示 | `plugins/shape-plugin/src/ui/__tests__/components/build-progress/` | shape-plugin の Vitest、既存 atom/test utility | `pnpm -w turbo run test --filter @hierarchidb/shape-plugin -- --run <target>` |
| Worker→UI の順序、別 node の排除、数値契約違反 | `plugins/shape-plugin/src/ui/components/build-progress/eventBufferingUI.ts` と既存 unit/property tests | `#1127` で確定した4イベント契約 | shape-plugin の targeted test + typecheck |
| build start 後の task list と summary | `e2e/shape/shape-build-startup-receiving-task-snapshot.spec.ts` | `@playwright/test`、E2E auth seed、実 Worker API | `pnpm e2e:shape-startup` |
| 性能観測項目 | 実測対象が確定した package の benchmark/test | deterministic input、fake clock、明示的な測定境界 | 対象 package の専用 benchmark/test |

旧 E2E の「既存 Shape へ fallback」「固定の `17/229`」「文言が見つからなくても継続」「`waitForTimeout` 後に assertion なし」は再利用しない。現行 E2E は node を Worker API で作成し、認証を事前検証し、`receiving-task-snapshot` の明示的な成功/失敗を観測しているため、旧2 specs の主要な価値をすでに代替している。

### 4. 直接回収可能

なし。

## 推奨する再開順序と後続 Issue 案

### 1. 既存 `#1127`: event contract を一意化する

`docs/build-session-worker-ui-event-spec.md`、`docs/build-session-worker-ui-event-design.md`、Issue 本文、`eventBufferingUI.ts` を同じ判断へ揃える。taskId/version を維持するか、全イベント FIFO に統一するかを明記し、契約違反を fallback せず throw する。

最小検証:

```bash
pnpm -w turbo run typecheck --filter @hierarchidb/shape-plugin
pnpm -w turbo run test --filter @hierarchidb/shape-plugin
```

### 2. 新規 Issue 案: `test(shape): cover canonical Worker-to-UI event contract`

依存: `#1127`

Scope:

- 4イベントだけを対象にする。
- 別 node の event が state を変更しないことを検証する。
- 非 finite の progress/heartbeat が即時失敗することを検証する。
- `#1127` で確定した順序規則を unit/property tests に固定する。
- stash の EventBuffer/Reconnection コードはコピーしない。

DoD:

- event spec の各契約に少なくとも1つの現行 package test が対応する。
- legacy 6 notification、global sequence、replay/reconnect をテストへ持ち込まない。
- shape-plugin typecheck/test が exit 0。

### 3. 新規 Issue 案: `test(shape): cover canonical Step5 view phases`

依存: `#1127` または前項 Issue

Scope:

- `No tasks yet`、`receiving-task-snapshot`、task list、`completed`、`failed` の表示遷移を現行 atom/controller 経由で検証する。
- pause/cancel control の enabled/disabled を session phase ごとに検証する。
- 固定件数、翻訳文字列だけの selector、既存データ fallback を使わない。

DoD:

- current `ShapeBuildProgressPanel` の public behavior を検証する。
- lifecycle と task list の二重 SSOT をテストに作らない。
- targeted test と shape-plugin typecheck が exit 0。

### 4. 新規 Issue 案: `test(shape): extend authenticated build-start E2E outcomes`

依存: 前2項

Scope:

- 現行 `shape-build-startup-receiving-task-snapshot.spec.ts` を基礎に、未被覆と確認できた outcome だけを追加する。
- Worker API で test node を作成・削除し、auth seed 不足は明示エラーにする。
- stable test id または role を使用し、screenshot は失敗時 artifact に限定する。

最小検証:

```bash
pnpm e2e:shape-startup
```

実行には有効な `E2E_AUTH_ACCESS_TOKEN` が必要である。

### 5. 新規 Issue 案: `chore(test): remove superseded root BuildSession test framework`

依存: 前3項で必要な behavior の置換を確認後

Scope:

- `src/test-framework` の 45 legacy files と専用 `vitest.config.ts` を削除する。
- `.kiro/specs/build-session-comprehensive-test` は、現行仕様へ全面改訂する必要がなければ削除する。
- 参照がないことを再確認し、置換先 Issue/テストを Issue 本文に列挙する。
- abandoned branch と stash の削除はこのコード cleanup とは分け、別承認で行う。

DoD:

- `rg` で削除対象への active import がない。
- root typecheck/test が exit 0。
- 置換済みの shape-plugin targeted tests が exit 0。
- rollback は cleanup commit の revert で可能。

性能・scalability の追加 Issue は現時点では起票しない。実 Worker 上の測定対象、環境、しきい値、再現条件が定義されてから、stash と独立した新規設計として扱う。

## 元データの掃除条件

### Remote branch

監査文書が `main` に入り、branch が全件 superseded であることを Issue 上で確認した後、明示承認を得て `origin/feature/test-framework/event-capture-impl` を削除できる。強制的な local branch 削除は行わない。

### `stash@{17}`

少なくとも本監査文書と後続 Issue の scope が GitHub 上に残り、直接回収対象がないことを再確認した後、明示承認を得て drop できる。それまでは SHA `d627934d45305c6084ad17794d27efb081b4bda5` を保存する。

## 付録A: common 10 files

- `.kiro/specs/build-session-comprehensive-test/tasks.md`
- `src/test-framework/core/EventCapture.ts`
- `src/test-framework/core/EventCaptureImpl.ts`
- `src/test-framework/core/SessionController.ts`
- `src/test-framework/core/SessionControllerImpl.ts`
- `src/test-framework/core/TestManager.ts`
- `src/test-framework/core/TestManagerImpl.ts`
- `src/test-framework/core/ValidationManager.ts`
- `src/test-framework/types/EventTypes.ts`
- `src/test-framework/types/SessionTypes.ts`

## 付録B: branch-only 22 files

- `.kiro/hooks/user-prompt-notification.kiro.hook`
- `.kiro/specs/build-session-comprehensive-test/.config.kiro`
- `.kiro/specs/build-session-comprehensive-test/design.md`
- `.kiro/specs/build-session-comprehensive-test/requirements.md`
- `src/test-framework/config/fast-check.config.ts`
- `src/test-framework/config/index.ts`
- `src/test-framework/core/__tests__/EventCaptureImpl.test.ts`
- `src/test-framework/core/__tests__/SessionControllerImpl.test.ts`
- `src/test-framework/core/__tests__/TestManagerImpl.test.ts`
- `src/test-framework/index.ts`
- `src/test-framework/types/ErrorTypes.ts`
- `src/test-framework/types/PerformanceTypes.ts`
- `src/test-framework/types/ScenarioTypes.ts`
- `src/test-framework/types/TestTypes.ts`
- `src/test-framework/types/ValidationTypes.ts`
- `src/test-framework/types/index.ts`
- `src/test-framework/utils/MockUtils.ts`
- `src/test-framework/utils/PropertyTestUtils.ts`
- `src/test-framework/utils/TestUtils.ts`
- `src/test-framework/utils/TimeUtils.ts`
- `src/test-framework/utils/index.ts`
- `src/test-framework/vitest.config.ts`

## 付録C: stash-only 35 files

- `TASKS.md`
- `e2e/global-setup.ts`
- `e2e/global-teardown.ts`
- `e2e/screenshots/01-initial-state.png`
- `e2e/screenshots/02-resources-opened.png`
- `e2e/screenshots/03-shape-not-found.png`
- `e2e/screenshots/08-navigation-failed.png`
- `e2e/shape-step5-simple.spec.ts`
- `e2e/shape-step5.spec.ts`
- `package.json`
- `packages/components/src/BuildControlCard.tsx`
- `packages/components/src/BuildStepPanel.tsx`
- `packages/components/src/BuildStepStagePanel.tsx`
- `playwright-simple.config.ts`
- `playwright.config.ts`
- `plugins/shape-plugin/src/ui/components/build-progress/ShapeBuildProgressPanel/useShapeBuildProgressPanelViewModel.ts`
- `src/test-framework/core/BuildSessionTestFramework.ts`
- `src/test-framework/core/BuildSessionTestFrameworkImpl.integration.test.ts`
- `src/test-framework/core/BuildSessionTestFrameworkImpl.ts`
- `src/test-framework/core/ErrorHandler.ts`
- `src/test-framework/core/ErrorHandlerImpl.ts`
- `src/test-framework/core/PerformanceMonitor.ts`
- `src/test-framework/core/PerformanceMonitorImpl.ts`
- `src/test-framework/core/ReconnectionManager.ts`
- `src/test-framework/core/ReconnectionManagerImpl.ts`
- `src/test-framework/core/ScalabilityVerifier.ts`
- `src/test-framework/core/ScalabilityVerifierImpl.ts`
- `src/test-framework/core/ValidationManagerImpl.ts`
- `src/test-framework/core/__tests__/EventBufferImpl.unit.test.ts`
- `src/test-framework/core/__tests__/PerformanceMonitorImpl.property.test.ts`
- `src/test-framework/core/__tests__/PerformanceMonitorImpl.unit.test.ts`
- `src/test-framework/core/__tests__/ReconnectionManagerImpl.property.test.ts`
- `src/test-framework/core/__tests__/ReconnectionManagerImpl.unit.test.ts`
- `src/test-framework/core/__tests__/ScalabilityVerifierImpl.property.test.ts`
- `src/test-framework/core/__tests__/ScalabilityVerifierImpl.unit.test.ts`
