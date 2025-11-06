# Repository Guidelines

## Project Structure & Module Organization
The workspace relies on `pnpm`. `app/` contains the main UI, with shared documentation in `app/docs/`. Core libraries live in `packages/` (runtime services, UI components, tooling), feature plugins in `plugins/`, and shared assets inside `docs/`, `reports/`, or package-level `dist/`. Tests are colocated: unit suites in `packages/*/src/__tests__/`, worker flows in `packages/runtime-worker/src/__tests__/wfl/`, and Playwright smoke tests in `e2e/`.

- **TypeScript path & references policy (2025-10-21, NodeNext 対応版)**
  - ルートの `tsconfig.base.json` に、ワークスペース alias（例: `@hierarchidb/foo`）を **必ず `src/` 指向で** 定義する。`dist/` 参照は登録しない。
  - 各パッケージの `tsconfig.json` では、原則として追加の `paths` を持たず、`tsconfig.base.json` の alias をそのまま利用する。暫定対処でローカル `paths` を追加した場合は、依存の `.d.ts` 出力が整い次第速やかに撤去する。
  - `tsconfig.build.json` では `paths` を空（もしくは最小限）に保ち、代わりに `references` で依存パッケージ（例: `../common/types/tsconfig.build.json`）を明示する。`tsc -b` で依存先の型出力を先に生成し、NodeNext の解決規約に従ってビルド順を保証する。
  - NodeNext では未生成の `dist/*.d.ts` を `paths` で直接指すと TS7016/TS6305 が即座に発生するため、**build 依存は project references に一本化** する。どうしても暫定で相対パスを追加する場合は、TASKS 運用ログに理由と撤去予定を記録すること。
  - Turbo 側は従来同様 `dependsOn: ['^build:types']` を設定しつつ、`pnpm typecheck:graph` が NodeNext モードでグリーンになることを DoD とする。必要に応じて `npx tsc -b` で依存チェーンの `.d.ts` を明示的に更新する。

## Build, Test, and Development Commands
- `pnpm install --frozen-lockfile` – sync dependencies before editing.
- `pnpm dev` / `pnpm dev:with-watch` – launch the app and worker watchers.
- `pnpm typecheck` – workspace TypeScript validation; append `pnpm --filter <pkg> typecheck` for targeted checks.
- `pnpm test` / `pnpm --filter @hierarchidb/runtime-worker test -- --run undo-folder-operations` – Vitest suites globally or for worker critical paths.
- `pnpm lint` / `pnpm format` / `pnpm biome:check` – enforce linting and formatting.
- `pnpm e2e` – execute Playwright smoke tests; capture failures in `TASKS.md`.

## Coding Style & Naming Conventions
TypeScript is standard. Keep one primary export per file, match CamelCase filenames to exported symbols, and avoid deep `../src` imports. Use `import.meta.env` instead of `process.env`, keep browser code free of Node globals, and run `pnpm format` plus `pnpm lint` or `pnpm biome:check` before review. Runtime feature flags backed by `FEATURE_FLAGS` have been retired—prefer explicit configuration modules or environment variables documented in `TASKS.md` when conditional behavior is unavoidable.

## Testing Guidelines
Run Vitest globally (`pnpm test`) or per package (`pnpm --filter <pkg> test`) and extend Worker Flow Lab suites under `packages/runtime-worker`. Playwright specs live in `e2e/`; name files `*.spec.ts` and clear skip markers quickly. Log each command and outcome in the TASKS運用ログ, add regression coverage for new logic, and document any remaining gaps with timestamps and next steps.

## Commit & Pull Request Guidelines
Use `TASKS.md` as the single source of truth: move cards to Doing, note branches as `<type>/<scope>/<slug>`, and record start/done timestamps. Follow Conventional Commits (`feat(runtime-worker): add undo redo guard`) and keep diffs focused. Before review run `pnpm lint && pnpm format && pnpm typecheck && pnpm test`, plus any package-specific checks you touched. PRs should list acceptance criteria, feature-flag defaults, verification evidence, and rollback steps so reviewers can revert safely.

## Agent Workflow Notes
Work in small, reviewable increments. Document sandbox blockers and attempted alternatives in `TASKS.md`, and never modify code without updating the Kanban and 運用ログ. Prioritise reversibility—capture config edits, migrations, and generated assets so a flag toggle or revert restores prior behaviour quickly.

### 失敗例（再発防止メモ）
- 2025-10-20: `@hierarchidb/batch-types` の型ビルドで `packages/features/batch/dist/index.d.ts` を生成せずに `api-extractor` を実行し、依存宣言だけ変更した時点で検証を怠ったため、ユーザー環境ではエラーが継続した。**教訓**: 依存パッケージのビルド有無を CLI で再現確認してから完了報告すること。必要であれば `prebuild:*` スクリプトなどで明示的に依存ビルドを組み込み、Turbo 以外の単独実行でも成功するよう担保する。

### 作業プロセスの自己ルール
- **DoD 提案義務**: ユーザーからタスク指示を受けるたびに、着手前に自分から DoD（受け入れ基準）を箇条書きで提案し、ユーザーの了承を得てから作業を開始する。承認前にタスクを進めない。
- **検証の明示**: 作業完了と主張する際は、成功ログ（コマンド名・終了コード・出力要点）を提示し、未検証の項目があれば理由と今後の案を記載する。
- **指示再確認**: 重要な指示（初期プロンプト、TASKS.md、個別依頼）は作業前に読み返し、回答直前にも遵守確認を行う。
- **疑義エスカレーション**: 不明点や仮定を伴う判断が必要な場合は、独断で決定せずにユーザーへ必ず確認を取る。
- **依存タスクの順序制御**: Turbo は同名タスク間でのみ順序保証される。runtime/plugin など別パッケージの `.d.ts` に依存する場合は、明示的に `pipeline.build(:types|:bundle)` を設定し、`prebuild:*` で `pnpm --filter <pkg> build(:types|:bundle)` を先行実行する。`tsup` は必要に応じて `clean: false` に設定し、生成済み dist を保持する。
- **依存タスクの順序制御**: 他パッケージの `.d.ts` を参照するビルドでは、依存先の `build` / `build:types` / `build:bundle` を Turbo で明示し、必要に応じて `prebuild:*` で `pnpm --filter <pkg> build[:types|:bundle]` を実行してから自パッケージの `tsc`/`tsup` を呼び出す。`tsup` が `dist/` を clean しないようにする（`clean: false`）ことも忘れない。
- **依存タスクの順序制御**: Turbo は同名タスク間でのみ順序保証される。`@hierarchidb/*` の `.d.ts` を使うプラグインは、Turbo の `pipeline` や `prebuild:*` で `pnpm --filter <pkg> build(:types|:bundle)` を先に呼び出し、さらに `tsup` は `clean: false` に設定して dist を消さないこと。
