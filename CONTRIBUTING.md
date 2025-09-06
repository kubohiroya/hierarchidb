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
