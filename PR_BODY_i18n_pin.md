# Pin i18next to v22 across workspace to avoid TS 4.9 type issues

## Summary
- Pins `i18next` to `22.5.0` at the root and in `@hierarchidb/ui-auth` to satisfy `react-i18next`’s peer and avoid v25’s advanced typings that break with TypeScript 4.9.
- Leaves shim removals and UI refactors for separate PRs.

## Changes
- Root `package.json`: add `devDependencies.i18next: 22.5.0`.
- `packages/ui/auth/package.json`: add `dependencies.i18next: 22.5.0`.
- `pnpm-lock.yaml`: updated to resolve `react-i18next@12.3.1` against `i18next@22.5.0`.

## Rationale
- `i18next@25` introduces types incompatible with TS 4.9, producing errors in UI packages.
- Pinning to v22 stabilizes types while we stay on TS 4.9. We can revisit v25 alongside a TS upgrade later.

## Impact
- Runtime: none (v22 remains compatible with current code).
- Type safety: removes `i18next@25`-driven type errors.

## Verification
1. Clean install: `pnpm -w install --force`.
2. Confirm versions: `pnpm -w why i18next` → all importers should resolve to `22.5.0`.
3. Typecheck: `pnpm typecheck` → no i18next-related errors.

## Follow-ups
- Remove spreadsheet i18n shims and tsconfig path aliases in a separate PR.
- Optional CI check to assert `i18next` major is locked to 22 until TS is upgraded.

