chore(tools): externalize dependency policy checker (dep-fence)

Summary
- Replace in-repo checker `packages/tools/check-deps` with the published CLI `dep-fence` (devDependency).
- Update scripts to invoke `dep-fence` via `pnpm exec`.
- Remove the obsolete `packages/tools/check-deps` package from the workspace.

Why
- Avoid maintaining a duplicated, local copy now that `dep-fence` is launched as a standalone tool.
- Ensure hierarchidb consumes the exact public version used by other repos.

Changes
- Remove: `packages/tools/check-deps/**`.
- package.json: add `dep-fence` to devDependencies; update `check:deps:pkg` to `pnpm exec dep-fence`.
- scripts/report-policy-summary.mjs: call `pnpm exec dep-fence --json`.
- scripts/check-maplibre-policy.mjs: import from `dep-fence`.
- docs/README-ja.md: wording to reference `dep-fence` package.

Notes
- Lockfile not updated in this PR; CI uses `--no-frozen-lockfile` (see `ci:install`) so installs will succeed.
- No runtime impact; the checker runs in dev/CI contexts only.

DoD
- CI passes (typecheck, lint, unit/e2e).
- `pnpm exec dep-fence` runs locally (after install) and in CI.

