# Repository Guidelines

- ユーザとの会話やドキュメント作成は日本語で行い、コードやテスト内のコメントは英語で行なうこと。

## Project Structure & Module Organization
- app: React front-end (routes, components, public assets).
- packages: Workspace modules by domain: common, node-type (plugins), runtime-*, ui/*, util, backend.
- e2e: Playwright end-to-end tests; reports in e2e-results/.
- docs: Project documentation; Storybook and migration notes.
- scripts: Helpers (start-env.sh, analysis, license checks).

## Build, Test, and Development Commands
- `pnpm dev`: Start development app via `scripts/start-env.sh` (http://localhost:4200).
- `pnpm build`: Production build across the monorepo (Turbo).
- `pnpm build:app`: Build only `@hierarchidb/app`.
- `pnpm test`: Run unit tests (Vitest) in parallel across packages.
- `pnpm e2e`: Run Playwright tests (spins up dev server automatically).
- `pnpm lint` / `pnpm format` / `pnpm typecheck`: ESLint, Prettier/Biome formatting, and TS checks.
- `pnpm storybook`: Launch Storybook for UI packages.

## Coding Style & Naming Conventions
- Language: TypeScript, 2-space indent, 100-col width, single quotes, semicolons (Prettier, Biome).
- Imports: Do not use relative paths; use aliases (`~`, `@hierarchidb/*`).
- Exports: Prefer explicit named exports (avoid `export *`).
- Files: Components `PascalCase.tsx`; utilities `kebab-case.ts`; tests `*.test.ts[x]`.

## Testing Guidelines
- Unit: Vitest with jsdom; setup files at `vitest.setup.ts`. Place tests alongside source or in `__tests__` using `*.test.ts[x]`.
- E2E: Playwright specs in `e2e/*.spec.ts`. Base URL `http://localhost:4200`, desktop and mobile projects configured. Run with `pnpm e2e`.
- Aim for meaningful coverage of core logic and plugin behavior; include rendering tests via `@testing-library/react` when applicable.

## Commit & Pull Request Guidelines
- Conventional Commits: `feat|fix|refactor|chore|docs` with optional scope.
  - Example: `feat(runtime-worker): add subscription batching`
- PRs: Clear description, scope, and rationale; link issues; include screenshots/GIFs for UI; update docs if behavior changes; ensure `pnpm test`, `pnpm e2e`, `pnpm lint` pass. Run `pnpm analyze:licenses` when adding deps.

## Security & Configuration Tips
- Env: Use `app/.env.secrets` for local secrets (never commit). See `.env.example` for defaults.
- Engines: Node >= 20, pnpm >= 9 (preinstall enforces pnpm).
- Use `scripts/start-env.sh <development|production> [dev|build|test]` for consistent environments.
