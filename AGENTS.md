# AGENTS.md — AI Contributor Guide (Codex/Claude/etc.)

This repository welcomes AI assistants. This document is the single source of truth for how AI agents should operate here. When other AI‑specific docs exist (e.g., CLAUDE.md), they must defer to this file.

## Read Order (for AI agents)
1) AGENTS.md (this file)
2) CONTRIBUTING.md (policies and packaging rules)
3) README.md (project overview; links to dev sections)
4) package.json scripts and scripts/*.sh (authoritative commands)
5) TASKS.md (worklog/branch policy)

Always search with `rg` first; read files in ≤250‑line chunks.

## Monorepo Map (high level)
- `app/` – Vite + React application
- `packages/runtime-worker/worker/` – Worker runtime (Comlink API)
- `packages/ui/*` – UI libraries (core, i18n, auth, treeconsole components, etc.)
- `packages/node-type/*` – UI/Worker plugins per node type (folder, shape, route, etc.)
- `packages/feature/*` – Feature modules (tag, import-export, tabular, …)
- `packages/tools/vite-plugin-package-reader` – Generates Vite virtual modules for plugins
- `scripts/start-env.sh` – Unified dev/build entry; also auto‑builds missing dists

## Dev Quick Start
- Install: `pnpm install`
- Start dev: `pnpm dev` (calls `scripts/start-env.sh development`)
- BFF proxy (auth): dev server proxies `/auth` to `VITE_BFF_BASE_URL` (see `app/vite.config.ts`).
  - Set `VITE_BFF_BASE_URL` in env for development; production builds should set an explicit URL.

## Common Pitfalls (and fixes)
- Missing dist for workspace packages → Vite resolution fails.
  - `scripts/start-env.sh` auto‑builds: ui‑*, runtime‑worker, node‑type plugins, util, feature modules, etc.
- Directory imports (EISDIR) → Always alias packages to an explicit file (e.g., `dist/index.js`).
- Route plugin emits `.mjs` → Alias to `dist/index.mjs`.
- Worker virtual modules not found → Ensure package‑reader plugin runs before `comlink` in `vite.config.ts` (worker.plugins).
- React StrictMode dev remounts are expected; avoid side‑effects on mount.
- Internal SSR pre‑analysis logs are benign during dev (react‑router dev).

## Build & Packaging Policy (summary)
- ESM first. Each package must export via `exports`: `"." -> { types, import, default }` pointing to `dist/*`.
- Set `main` and `module` to `dist/index.js` (or `.mjs` if intentionally emitted).
- Use shared `tsup.base.config.ts`. Externalize peer‑managed runtime libs (React/MUI/etc.).
- Packages referenced by `app/` or Worker must produce `dist/` compatible with Vite (ESM).
- Deep imports used by Worker may be aliased to `src/*` when necessary (see `app/vite.config.ts`).

## Vite & Worker Notes
- Aliases are defined in `app/vite.config.ts` for all `@hierarchidb/*` imports used by UI/Worker.
- Worker plugin order: run `tools-vite-plugin-package-reader` first, then `comlink`.
- Toggle WorkerAPIClient logs: set `VITE_WORKERAPI_LOG=1` (default off).

## Analyze Licenses
- `pnpm build` runs `analyze:licenses` in prebuild.
- Tool lives in `packages/tools/analyze-licenses` (simple CLI using license‑checker).

## Branch/PR Rules (AI focus)
- Do not edit `TASKS.md` on feature branches unless explicitly requested. Prefer a docs branch (or log via PR description).
- Make surgical diffs. Do not refactor unrelated code. Keep commits scoped and descriptive.
- If build or typecheck fails locally, fix root cause rather than silencing checks.

## How This Agent Works (Codex CLI specifics)
- Prefer `rg` for search; read files in ≤250 lines.
- Use `apply_patch` for edits. Avoid changing unrelated files.
- Provide a short preamble before running tools; keep a small, living plan with `update_plan` when multi‑step.
- Ask before destructive ops; never remove checks/lints unless owner requests.

## When in doubt
- Ask for clarification. Link to concrete files/lines. Default to safety and minimalism.

