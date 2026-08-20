# CI validation specification

## 目的

PR の待ち時間を短縮しながら、変更された workspace package の build、typecheck、unit test、lint を必ず検証する。モノレポ全体を毎回実行する代わりに、Git の base/head 差分から変更 package をentry pointとして選択し、Turboのtask graphで必要な上流packageだけを実行する。

## PR validation

`CI Validation` workflow は pull request の base SHA と head SHA を明示的に取得する。`scripts/ci/resolve-validation-mode.mjs` は変更パスを次の順序で分類する。

1. Markdown、`docs/`、`plans/`、`reports/`、`.kiro/`、`LICENSE` だけの変更は `skip` とする。workflow の `paths-ignore` も同じ変更を起動対象外にする。
2. `app/`、`packages/`、`plugins/` の内側だけにある非ドキュメント変更は `affected` とする。
3. それ以外の非ドキュメント変更は repository-wide input とみなし、`full` とする。root `package.json`、lockfile、workspace/Turbo/TypeScript/Vitest/tsdown 設定、`.github/`、`scripts/`、`config/` の変更がこの分類に含まれる。

`affected` では `TURBO_SCM_BASE` と `TURBO_SCM_HEAD` を固定し、Turbo filter `[<base>...<head>]` で直接変更されたpackageをentry pointにする。`build typecheck test lint`のtask依存に必要な上流packageは実行するが、変更packageを利用する下流packageのtestとlintはPRごとに実行しない。下流packageを含む回帰検証はmainのfull validationが担当する。

Turboの成功task logは`errors-only`で抑制し、失敗taskの診断情報とrun summaryだけを表示する。

base/head が欠落、不正、未取得、または差分が空の場合はCIを失敗させる。`full` や成功への暗黙フォールバックは禁止する。

## Full validation

次の場合は全 workspace の `build lint` を実行する。

- repository-wide input を含むPR
- `main` への push
- `workflow_dispatch`

同じ ref の古い実行は concurrency 制御でキャンセルし、最新commitの検証を優先する。

現行mainのfull workspace testは、Vitest project間で同じ`sequence.groupOrder`に異なる`maxWorkers`が設定されているため、test開始前に失敗する。full workspace typecheckも`styler-plugin`のself-referenceを解決できず失敗する。これらの既存不整合が別Issueで解消されるまでは、full validationへtestとtypecheckを含めない。package-local PRでは変更packageのtestとtypecheckをblockingで実行し、失敗の無視や`|| true`による成功化は禁止する。

## Repository-wide checks

Dep-Fence strict、dependency guard、license summary、公開型参照・shim・`as any` budget・UI hook配置のポリシー、CI scope resolverのunit testは package-local taskとは別のrepository-wide blocking checksとしてPRとmainで実行する。lintはaffected/full package validationに統合し、二重実行しない。

Dependency CruiserとSyncpackは非blocking診断である。PRごとのblocking validationから外し、週次または手動の`Repository Diagnostics` workflowで実行する。publish artifactを生成しない状態のPublintとAre The Types WrongはCI診断から外し、release/package検証時の明示コマンドとして残す。

Naming Auditは`docs/ts-file-naming-guideline.md`のbase/head比較契約を維持する。audit実行に必要なroot dependenciesだけをinstallし、workspace全体のlinkは行わない。

## Runtime policy

workflow内のproject commandは`actions/setup-node`の`node-version: 24`で実行する。これは`actions/checkout`などのJavaScript action自身が使用するruntimeとは独立した契約である。action runtimeの非推奨警告を抑える目的でproject Nodeを変更してはならず、対象actionをNode 24 runtime対応majorへ更新する。

現行workflowは`actions/checkout@v7`、`actions/setup-node@v7`、`actions/cache@v6`、`pnpm/action-setup@v6`を使用する。major更新時は既存inputの互換性を確認し、actionlint、YAML parse、実CIを通してNode runtimeの非推奨annotationが発生しないことを検証する。

## Cache policy

Turbo local cache keyはlockfile、実行scope、commit SHAを含む。

- PRは同じPR番号の直前cacheを最優先で復元する。
- PR固有cacheがなければmain cacheを復元する。
- main pushのfull validationは次のPR用cacheを生成する。
- commit SHAごとにprimary keyを変え、restoreしたcacheへ新しいtask resultを追加した状態を保存できるようにする。

cache missは検証対象を増やす理由にしない。対象選択はGit差分とpackage graph、実行省略はtask hash cacheという別の責務として扱う。

## Rollback

問題が発生した場合はworkflow、root CI scripts、scope resolverをrevertし、従来の`pnpm run ci:checks`と全workspace `pnpm run build`へ戻す。affected selectionの欠落が疑われる場合は、原因が解消されるまでworkflowを明示的なfull validationへ切り替える。判定失敗を成功扱いにするフォールバックは追加しない。
