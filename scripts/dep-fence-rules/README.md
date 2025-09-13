# Proposed dep-fence Custom Rules (PR Materials)

This folder contains self-contained, upstream-ready rule implementations for dep-fence.
They mirror the checks we already run in `scripts/dep-fence-extra.mjs`, but are structured
as reusable rules that dep-fence can load.

Rules included
- maplibre-allowlist: Allow only specific packages to declare direct dependencies on MapLibre stack.
- ui-peer-policy: Enforce that UI foundation libs (react, react-dom, @mui/*, @emotion/*) are peerDependencies
  (and not regular dependencies).

Design assumptions
- Minimal Rule API (proposed):
  - A rule module exports `id`, `meta`, and a `create(options)` function returning a `check(ctx)` function.
  - `ctx` exposes the current package.json (`ctx.pkg`), its absolute dir (`ctx.dir`), and helper `report(violation)`.
  - Violation shape: `{ message: string, severity: 'ERROR' | 'WARN', where?: string }`.
- The final API can be adapted to dep-fence’s internal types; the core logic is isolated per rule.

Usage (inside dep-fence)
- Core (or plugin host) loads rule modules, calls `create(options)`, then calls the returned `check` for each package.
- See inline JSDoc for details.

