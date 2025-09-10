# Repository Guidelines

## Project Structure & Module Organization
- Monorepo managed by pnpm/turbo. Key roots:
  - `app/` runtime UI app
  - `packages/` feature, UI, worker, and node-type plugins
  - `packages/runtime-worker/worker/` worker-side platform
  - `packages/node-type/*-plugin/` plugin packages (e.g., shape, route, location)
  - `e2e/`, `docs/`, `.turbo/`, and config files at repo root
- Source lives in `src/`; compiled output goes to `dist/` (tsup). Tests sit alongside code as `*.test.ts(x)`.

## Build, Test, and Development Commands
- Install: `pnpm i`
- Build all: `pnpm -w build` (tsup per package)
- Typecheck all: `pnpm -w typecheck` (tsc, dist-only imports enforced)
- Test (root, coverage): `pnpm -w vitest run --coverage`
- Test a single package (recommended): `pnpm -C packages/node-type/shape-plugin test:run`
- Storybook (if applicable): `pnpm -C app storybook`

## Coding Style & Naming Conventions
- Language: TypeScript (strict). Prefer explicit types.
- Formatting/Lint: Prettier config at root; ESLint present; keep imports ordered. Indent 2 spaces.
- Import policy: use public entrypoints (dist-only). Avoid deep imports like `@…/pkg/src/*`. Example: `import { useBatchProgress } from '@hierarchidb/ui-core'` (✅) not `@hierarchidb/ui-core/src/*` (❌).
- DB naming: use `getDBName('kebab-suffix')`; do not hardcode database names.
- Filenames: kebab-case for files, PascalCase for React components.

## Testing Guidelines
- Framework: Vitest (+ jsdom). Many packages pin `pool: 'threads', max/minThreads: 1` to avoid sandbox issues—run tests per package when possible.
- Test names: `*.test.ts` or `*.test.tsx`; colocate near source.
- Coverage: collected via root vitest config; no hard threshold enforced unless specified in package.

## Commit & Pull Request Guidelines
- Commits: short, imperative subject; include scope when helpful (e.g., `shape-plugin: fix unified batch adapter`). Reference issues like `#123`.
- PRs: clear description, rationale, screenshots/logs for UI/worker changes, and checklists for build, typecheck, tests. Link related issues and note any migration or config impacts.

## Architecture & Agent Tips
- Batch orchestration uses “adapters” to prefer runtime-worker; avoid adding new direct WorkerPool usages.
- When adding paths or aliases, keep dist-only resolution in `tsconfig.base.json` and per-package tsconfig/vitest configs.
- Prefer adding new shared logic under `packages/runtime-shared/*` or `packages/util/` over duplicating code in plugins.
