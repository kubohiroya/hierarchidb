# Repository Guidelines

## Project Structure & Module Organization
The workspace relies on `pnpm`. `app/` contains the main UI, with shared documentation in `app/docs/`. Core libraries live in `packages/` (runtime services, UI components, tooling), feature plugins in `plugins/`, and shared assets inside `docs/`, `reports/`, or package-level `dist/`. Tests are colocated: unit suites in `packages/*/src/__tests__/`, worker flows in `packages/runtime-worker/src/e2e/__tests__/`, and Playwright smoke tests in `e2e/`.

## Build, Test, and Development Commands
- `pnpm install --frozen-lockfile` – sync dependencies before editing.
- `pnpm dev` / `pnpm dev:with-watch` – launch the app and worker watchers.
- `pnpm typecheck` – workspace TypeScript validation; append `pnpm --filter <pkg> typecheck` for targeted checks.
- `pnpm test` / `pnpm --filter @hierarchidb/runtime-worker test -- --run folder-undo-redo` – Vitest suites globally or for worker critical paths.
- `pnpm lint` / `pnpm format` / `pnpm biome:check` – enforce linting and formatting.
- `pnpm e2e` – execute Playwright smoke tests; capture failures in `TASKS.md`.

## Coding Style & Naming Conventions
TypeScript is standard. Keep one primary export per file, match CamelCase filenames to exported symbols, and avoid deep `../src` imports. Use `import.meta.env` instead of `process.env`, keep browser code free of Node globals, and run `pnpm format` plus `pnpm lint` or `pnpm biome:check` before review. Register new feature toggles in `config/feature-flags.ts` with default OFF and note them in `TASKS.md`.

## Testing Guidelines
Run Vitest globally (`pnpm test`) or per package (`pnpm --filter <pkg> test`) and extend Worker Flow Lab suites under `packages/runtime-worker`. Playwright specs live in `e2e/`; name files `*.spec.ts` and clear skip markers quickly. Log each command and outcome in the TASKS運用ログ, add regression coverage for new logic, and document any remaining gaps with timestamps and next steps.

## Commit & Pull Request Guidelines
Use `TASKS.md` as the single source of truth: move cards to Doing, note branches as `<type>/<scope>/<slug>`, and record start/done timestamps. Follow Conventional Commits (`feat(runtime-worker): add undo redo guard`) and keep diffs focused. Before review run `pnpm lint && pnpm format && pnpm typecheck && pnpm test`, plus any package-specific checks you touched. PRs should list acceptance criteria, feature-flag defaults, verification evidence, and rollback steps so reviewers can revert safely.

## Agent Workflow Notes
Work in small, reviewable increments. Document sandbox blockers and attempted alternatives in `TASKS.md`, and never modify code without updating the Kanban and 運用ログ. Prioritise reversibility—capture config edits, migrations, and generated assets so a flag toggle or revert restores prior behaviour quickly.
