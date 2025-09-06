# Contributing Guide (CI/Types Stability – Short Guide)

This repository prioritizes prebuild typecheck stability and consistent CI results. Follow these MUSTs for any package (UI, runtime-ui, node-type, features, tools).

- Types at source: package.json must set `types` and `exports.types` to `src/index.ts`.
- Public TSX return types: exported TSX must return `JSX.Element` (or `JSX.Element | null`).
- No tsconfig paths in public source: do not use `~/` or custom paths – use relative imports.
- Do not bundle React/MUI: put them in `peerDependencies` and mark them `external` in tsup.
- No `../src` deep imports across packages: import the public entry or d.ts only.
- Browser env: do not use `process.env`; use `import.meta.env` (`VITE_*`).
- Backend (Workers/Hono): use TypeScript 5 with `moduleResolution: bundler` for typecheck.
- CI hygiene: checkout PR head sha; `pnpm store prune` + `pnpm install --force`; remove `dist` and `*.tsbuildinfo` before typecheck.
- Local reproducibility: use `pnpm ci:clean`, `ci:install`, `ci:typecheck:local`, or `ci:all:local`.

Further details are duplicated in:
- `packages/ui/README.md` (UI libraries)
- `packages/runtime-ui/README.md` (app integration packages)
- `packages/node-type/README.md` (plugin system packages)
## Repository Policies (Build & Packaging)

- ESM first: packages must export via `exports` with `import`/`default` pointing to `dist/*` and publish `types`.
- Set `main` and `module` to `dist/index.js` (or `.mjs` if intentionally emitted by tsup).
- Use `tsup.base.config.ts`; externalize peer‑managed runtime libs (React, MUI, etc.).
- UI/Worker‑consumed packages must have a buildable `dist/` (Vite resolves to files, not directories).
- Vite aliases: see `app/vite.config.ts` – prefer explicit file targets (`dist/index.js`), or `src/*` for deep imports.
- Worker virtual modules: ensure `tools-vite-plugin-package-reader` runs before `comlink` in `vite.config.ts` (worker.plugins).
- Dev entry: use `scripts/start-env.sh` – it auto‑builds missing dists before dev.
- Do not silence checks; fix root causes (exports/main/types/externals) instead.

## Branch & PR Conventions

- Keep diffs surgical; avoid cross‑package refactors unless requested.
- `TASKS.md` edits should be made on a docs branch unless explicitly requested on a feature branch.
- Commit style: `feat:`, `fix:`, `chore:`, `docs:`, etc. Include scope where helpful.
