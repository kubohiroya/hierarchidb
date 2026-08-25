# CI validation specification

## 目的

PR の待ち時間を短縮しながら、変更された workspace package の blocking task を必ず検証する。モノレポ全体を毎回実行する代わりに、Git の base/head 差分から変更 package をentry pointとして選択し、Turboのtask graphで必要な上流packageだけを実行する。

## PR validation

`CI Validation` workflow は pull request の base SHA と head SHA を明示的に取得する。`scripts/ci/resolve-validation-mode.mjs` は変更パスを次の順序で分類する。

1. Markdown、`docs/`、`plans/`、`reports/`、`.kiro/`、`LICENSE` だけの変更は `skip` とする。workflow の `paths-ignore` も同じ変更を起動対象外にする。
2. `app/`、`packages/`、`plugins/` の内側だけにある非ドキュメント変更は `affected` とする。`pnpm-lock.yaml` は単独変更、または workspace-local 変更との組み合わせであれば `affected` に含める。
3. それ以外の非ドキュメント変更は repository-wide input とみなし、`full` とする。root `package.json`、workspace/Turbo/TypeScript/Vitest/tsdown 設定、`.github/`、`scripts/`、`config/` の変更がこの分類に含まれる。`pnpm-lock.yaml` も repository-wide input と同時に変更された場合は `full` とする。

`affected` では `TURBO_SCM_BASE` と `TURBO_SCM_HEAD` を固定し、Turbo filter `[<base>...<head>]` で直接変更されたpackageをentry pointにする。既定のblocking taskは`typecheck,test`であり、task依存に必要な上流packageは実行するが、変更packageを利用する下流packageのtestとlintはPRごとに実行しない。下流packageを含む回帰検証はmainのfull validationが担当する。必要に応じて`CI_AFFECTED_TASKS`で一時的にtaskを追加できるが、既定taskの拡大はCI時間への影響を確認する別Issueを必要とする。

Vite、Turbo、build scriptなどのconfig評価時に直接または間接的にworkspace packageを読み込むpackageは、そのworkspace packageを直接dependencyとして宣言し、Turboのtask graphへbuild依存を明示する。必要な`dist`生成を、別taskのcache miss時にだけ発生する副作用へ依存させてはならない。

Turboの成功task logは`errors-only`で抑制し、失敗taskの診断情報とrun summaryだけを表示する。

base/head が欠落、不正、未取得、または差分が空の場合はCIを失敗させる。`full` や成功への暗黙フォールバックは禁止する。

## Full validation

次の場合は全 workspace の `build lint` を実行する。

- repository-wide input を含むPR
- `main` への push
- `workflow_dispatch`

同じ ref の古い実行は concurrency 制御でキャンセルし、最新commitの検証を優先する。

Full workspace testは、Vitest project間でworker scheduling設定が競合しないよう、必要なprojectに明示的な`sequence.groupOrder`を与える。full validationへのtest追加は全workspaceの独立した検証と別Issueを必要とする。full workspace typecheckを妨げていた`styler-plugin`のself-referenceは#1368で解消したが、full validationへのtypecheck追加も全workspaceの独立した検証と別Issueを必要とする。package-local PRでは変更packageのtestとtypecheckをblockingで実行し、失敗の無視や`|| true`による成功化は禁止する。

## Repository-wide checks

Dep-Fence strict、dependency guard、shim・`as any` budget・UI hook配置のポリシーは、package-local taskとは別のaffected repository-wide blocking checksとしてPRで実行する。license summaryはfull validationで実行する。affected PRでは変更packageの`typecheck,test`とaffected repository-wide checksを実行し、license summaryのようなheavy checkだけを避ける。

CI scope resolverのunit testは、CI workflow、root `package.json`、または`scripts/ci/`が変更されたPRでだけblocking実行する。`main` pushと`workflow_dispatch`ではfull validationの一部として実行する。公開型参照ポリシー`policy:ban-tsconfig-paths-dist-dts`はdisabled policyであり、blocking CIから外す。再度有効化する場合は、契約を更新してからCIへ戻す。

Dependency CruiserとSyncpackは非blocking診断である。PRごとのblocking validationから外し、週次または手動の`Repository Diagnostics` workflowで実行する。publish artifactを生成しない状態のPublintとAre The Types WrongはCI診断から外し、release/package検証時の明示コマンドとして残す。

Naming Auditは`docs/ts-file-naming-guideline.md`の固定baseline比較契約を維持する。PRごとにbase worktreeを作成せず、headのchanged filesを`scripts/naming-audit-baseline.json`と比較する。audit実行に必要なroot dependenciesだけをinstallし、workspace全体のlinkは行わない。

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
