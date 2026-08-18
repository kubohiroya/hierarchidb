# Repository Resume Audit — 2026-08-18

## 目的とスコープ

中断後の作業再開にあたり、`main`、ブランチ、PR、stash、作業ツリー、Issue、CI の状態を読み取り専用で棚卸しした。ブランチや stash の削除、stash の適用、production code の変更、baseline build/test はこの監査の対象外とする。

監査の追跡先は GitHub Issue [#1235](https://github.com/kubohiroya/hierarchidb/issues/1235)。タスク状態の SSOT は GitHub Issues + Project であり、ローカル Markdown 台帳は廃止する。

## Executive Summary

| 項目 | 監査結果 |
| --- | --- |
| 基準 | `main` = `origin/main` = `681d07a8914b8b38468d2cfa2707ae344455d7d4` |
| 基準コミット | `Fix/shape plugin/restore disable hover lift (#1234)`、2026-04-13 13:44:52 JST |
| Open PR | 0 |
| remote refs | 106 |
| `origin/main` に topology 上未マージ | 94 |
| 上記のうち merged PR の head と一致 | 83 |
| PR なし | 5 |
| merged PR 後に branch が進んだもの | 5 |
| closed PR の head と一致 | 1 |
| local branches | 16（`main` を含む） |
| stashes | 52 |
| open Issues | 166 |
| 元の作業ツリー | 未追跡 `#package.json#` 1件 |

GitHub の Squash & Merge では branch tip が `main` の祖先にならないため、`git branch --no-merged` の結果だけでは未回収作業を判定できない。PR の head SHA、merged 状態、現在の tree 内容を組み合わせて分類した。

## 推奨する再開順序

1. 本 Issue #1235 でタスク管理を GitHub Issues + Project に一本化し、この監査結果を確定する。
2. `origin/feature/test-framework/event-capture-impl` と `stash@{17}` を隔離 worktree で復元・比較し、テスト基盤の回収 Issue を作る。
3. `origin/feat/simulation-workflow/implement-package` の post-merge documentation commit から、現行実装に有効な仕様だけを回収する。
4. Issue #1127 の Worker→UI event version / dedup 仕様矛盾を、コード変更前に仕様書側で解消する。
5. Node 24 と `pnpm 10.29.3` に合わせた clean install と段階的 baseline 検証を実行する。
6. 上記の判断後に、merged/superseded branch と不要 stash の削除候補を再確認する。監査時点では削除しない。

## Branch Inventory

### PR との照合で回収不要と判定した branch

topology 上未マージの remote ref 94 本のうち 83 本は、remote branch head が merged PR の head と完全一致していた。これは主に Squash & Merge による見かけ上の未マージであり、回収対象ではない。

local branch では次の 12 本が同じ分類に入る。

- `chore/treeconsole/migrate-atomfamily-jotai-family`
- `docs/readme/package-plugin-readme-docs`
- `feat/ide-gsm-client/implement`
- `feat/scripts/decomposition-analyzer`
- `feat/treeconsole/background-context-menu`
- `feat/treeconsole/column-target-path`
- `feat/treeconsole/view-mode-system`
- `feat/yaml-file-node/implement`
- `fix/shape-plugin/restore-disableHoverLift`
- `refactor/gis-sdk/decompose-vectorTiles`
- `refactor/router/url-path-restructure`
- `refactor/styler-plugin/decompose-colorUtils`

削除する場合は、各 PR の merge と worktree の clean 状態を再確認してから通常の `git branch -d` を使う。強制削除はしない。

### 個別判断が必要な 11 remote branches

| branch | 状態 | 推奨判断 |
| --- | --- | --- |
| `feature/test-framework/event-capture-impl` | PR なし。4 commits、32 files、約 6,240 insertions。TestManager、SessionController、EventCapture、ValidationManager などを含む | 最優先で隔離復元 |
| `feat/simulation-workflow/implement-package` | PR #1161 merge 後に `.kiro/specs/simulation-workflow/*` を追加した commit がある | 現行実装と照合して documentation のみ回収候補 |
| `chore/naming-audit/audit-tool-and-tsx-guideline` | PR #1182 merge 後に Kiro docs/routes と P2 skip fix がある | functional fix は `main` 済み。docs のみ再評価 |
| `fix/components/remove-unused-customSizeSx` | PR なし、1 deletion | 現在の `main` ですでに変数なし。superseded |
| `fix/shape/github-pages-payload-generation-825` | PR なし。debug logging と旧台帳変更 | PR #911 の後継実装で superseded |
| `fix/shape-plugin/queued-phase-missing` | PR #1056 closed | 後継 PR #1057 merged。superseded |
| `fix/app/type-guard-worker-events-1125` | PR #1126 merged 後に履歴が分岐 | 旧構成で stale。直接 merge しない |
| `fix/auth/export-auth-required-error` | PR #982 merge 後に 1 行の navigation fix | 対象ファイルが現行に存在せず stale |
| `ERIA-Cartograph` | PR #316 は同 branch 向け。main には未統合 | 対象構成が現行で消失。必要なら挙動を新規実装 |
| `gh-pages` | GitHub Pages deployment branch | 実装 branch 集計から除外 |
| `detached` | deployment-like、`main` より大幅に古く約 4,591 files の差分 | 隔離・実装対象外 |

その他の local branch:

- `feat/simulation-workflow/implement-package`: 上表の post-merge documentation commit を保持。
- `feat/simulation-workflow/implement`: `feat/ide-gsm-client/implement` と同じ SHA を指す local-only checkpoint で、固有差分なし。
- `gh-pages`: deployment branch。

## Stash Inventory

stash は 52 件あり、作成月は 2026-04 が 2 件、2026-03 が 17 件、2026-02 が 13 件、2025-09 が 20 件。mixed change や旧パスを多く含むため、`stash pop` は行わず、必要なものを隔離 worktree で patch として調査する。

| stash | 内容 | 判断 |
| --- | --- | --- |
| `stash@{0}` | router dialog 2 files と generated plugin registry 5 files、+231/-2 | generated files は `main` と同一。router 差分は進化済みで直接適用しない |
| `stash@{1}` | Kiro package/readme・naming specs と generated registry、+881/-2 | generated files は同一。docs の有効性のみ再評価 |
| `stash@{2}` | fflate/import-export、5 files、+321/-169 | PR #1110 merged。stale |
| `stash@{3}` | #1101 fflate と #1104 Vitest v4 の混在、54 files | 22 files は `main` と同一、残りは進化。直接適用しない |
| `stash@{4}` | Worker/UI event spec、adapter、buffering、tests、17 files | Issue #1127 の仕様矛盾と重なる。仕様確定まで保全 |
| `stash@{14}` | diff なし | 後の cleanup 候補 |
| `stash@{17}` | BuildSession comprehensive test、45 files、+8,600/-570 | 最重要。test-framework branch の続きとして隔離復元 |
| `stash@{21}` | shape UI/controller/worker sequence rewrite、63 files | 旧パス中心で likely superseded |
| `stash@{23}` | folder export/import、migrations 等の混在、188 files | 大規模 mixed stash。隔離継続 |
| `stash@{24}` | rel2abs の機械的変更、742 files | 現行構成に直接適用しない |
| `stash@{32,43,44,45}` | 旧 architecture の大規模差分 | quarantine 継続 |

`stash@{17}` には BuildSession E2E、`BuildSessionTestFramework`、`PerformanceMonitor`、`ReconnectionManager`、`ScalabilityVerifier` と関連 core update が含まれる。元 branch 名と内容が一致しないため、復元時は専用 Issue / branch / worktree を新設し、`origin/feature/test-framework/event-capture-impl` との包含関係を commit・file 単位で確認する。

## Uncommitted Working Tree

監査開始時の元 worktree `/Users/hiroya/WebstormProjects/hierarchidb` には、未追跡ファイル `#package.json#` が 1 件ある。通常の `package.json` に対して `jscodeshift` 行頭へ余分な `a` が入った editor temporary file と見られる。

- tracked file の未コミット差分はなし。
- 一時ファイルは削除せず保全した。
- 本 Issue の専用 worktree には持ち込んでいない。
- cleanup はユーザーが不要と確認した後に行う。

## Issue / Documentation Reconciliation

- 監査開始時のローカル台帳には、closed 済みの #1175 / #1155 と open の #1127 / #1020 / #1019 / #1018 が混在していた。ローカル台帳は削除し、以後 GitHub の状態だけを正とする。
- #1020 は現行コード上で invalid/missing status を throw する実装が確認でき、Issue の再評価が必要。
- #1018 は subscription initial snapshot 対応が merged 済みで、Issue の再評価が必要。
- #1019 は現在の architecture と乖離している可能性が高く、Issue の Scope を再確認する。
- #1127 は仕様の矛盾が残るため open のまま妥当だが、実装前に仕様判断が必要。

### Issue #1127 の仕様矛盾

`docs/build-session-worker-ui-event-spec.md` には `TaskProgress` の `taskId` / `version` と per-task dedup を要求する記述がある一方、後段では adapter が dedup/version を行わず FIFO 適用すると記載されている。`docs/build-session-worker-ui-event-design.md` も `eventVersion` を利用しないとしているが、現行 `plugins/shape-plugin/src/ui/components/build-progress/eventBufferingUI.ts` は per-task version dedup を実装している。

したがって #1127 ではコードを先に変更せず、正規仕様を確定し、spec / design / implementation の三者を同じ変更で一致させる。

## CI / Toolchain Baseline

- package manager: `pnpm 10.29.3`
- engines: Node `>=20`
- CI: Node 24
- 監査環境: Node `v26.5.0`
- 最新の `CI Policy Checks` は success。ただし `Biome + Deprecations` は skip されており、full typecheck/test の green を示す証拠ではない。

baseline 検証は Node 24 を使う clean environment で次の順に別 Issue として行う。

1. `pnpm install --frozen-lockfile`
2. 変更対象 package の build / typecheck / test
3. root `pnpm typecheck`
4. root `pnpm test`
5. 必要に応じて `pnpm lint` / `pnpm e2e`

## 保全ルール

- branch と stash は回収判断が完了するまで削除しない。
- recovery では `stash pop` を使わず、専用 worktree へ安全に展開して比較する。
- deployment branch を実装 branch として merge しない。
- topology の `--no-merged` だけで削除判断をしない。PR state、head SHA、tree equivalence を再確認する。
- remote cleanup、Issue 更新、push、PR 作成などの外部公開操作は、対象を提示してユーザー承認を得てから行う。
