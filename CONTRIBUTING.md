# Contributing

Thank you for contributing! This repository follows a few simple rules to keep the monorepo healthy and developer experience smooth.

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

