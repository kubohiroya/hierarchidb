# @hierarchidb/check-deps

Condition-driven dependency/TypeScript policy checker for monorepos that always explains “why”.

## Why another checker?

Most tools validate “what” is wrong (cycles, extraneous deps, bad exports), but teams still need a place to encode “why our repo wants this rule”. This package adds a thin, policy-first layer that:

- Expresses rules as conditions on package attributes (e.g., UI + publishable) instead of hard-coded package lists.
- Emits findings with an explicit rationale (Because: ...), making reviews and refactors easier.
- Covers a few gaps not well served elsewhere (tsup externals vs peerDependencies, skipLibCheck governance, tsconfig baselines).

It is intentionally small and complements existing, battle-tested tools (dependency-cruiser, syncpack, publint, @arethetypeswrong/cli, eslint-plugin-import), not replaces them.

## When is it useful?

Use this checker when you need to:

- Keep UI packages from bundling shared singletons (React/MUI/Emotion) and rely on host app peers instead.
- Prevent double-bundling by aligning tsup `external` with `peerDependencies`.
- Enforce TypeScript baselines across packages and avoid `../src` direct references.
- Track and justify temporary debt toggles like `skipLibCheck` with an explicit reason.
- Provide reviewers with the “reason” behind each violation, not just the rule id.

If you only need import graph rules or version alignment, defer to dependency-cruiser and syncpack.

## What this is not

- Not a replacement for dependency-cruiser, ESLint, or publint. Use them alongside this tool.
- Not a bundler or a type checker; it reads metadata and filesystem to validate policy.

## How it fits with other tools

- dependency-cruiser: import boundaries, layering, cycles.
- eslint-plugin-import: extraneous/undeclared deps.
- syncpack: workspace dependency version consistency.
- publint + @arethetypeswrong/cli: publish-time exports/types sanity.

This package focuses on: tsup×peerDependencies alignment, skipLibCheck governance, tsconfig hygiene, and reasoned policy reporting.

## Features

- Attribute inference: `ui`, `publishable/private`, `usesTsup`, `hasTsx`, `browser/node`, `worker`, `next`, `storybook`, `app`.
- Condition DSL: `all(...)`, `any(...)`, `not(...)`, and helpers like `isUI()`, `isPublishable()`, `usesTsup()`.
- Reason-carrying findings: every violation prints “Because: <your rationale>”.
- Typed policies: author rules in TypeScript with full IDE support.
- CLI: `hdb-check-deps [--strict]` prints a per-package report.

## Quick start

1) Install in your workspace (or keep it as a local tool package like this repo).

2) Optionally, create `check-deps.config.ts` at the repo root to override default policies:

```ts
import { isUI, isPublishable } from '@hierarchidb/check-deps/conditions';
import type { Policy } from '@hierarchidb/check-deps/types';

export const policies: Policy[] = [
  { id: 'ui', when: isUI(), because: 'UI should not bundle React/MUI', rules: ['ui-in-deps','peer-in-external'] },
  { id: 'pkg-ts', when: isPublishable(), because: 'Publishable hygiene', rules: ['tsconfig-no-base','paths-direct-src'] },
];
```

3) Run: `hdb-check-deps` (use `--strict` to exit non-zero on ERRORs).

## Built-in policies (overview)

- UI (publishable): require React/MUI as peers, forbid bundling, ensure peers ⊆ tsup.externals.
- Packages using tsup: peers must be external to avoid double-bundling.
- Publishable packages: extend repo tsconfig base and avoid `../src` path references.
- TSX present: require `jsx: react-jsx` for correct typing/emit.
- `skipLibCheck`: not allowed unless explicitly permitted or justified with a reason.

See `src/config.default.ts` for the exact rules and comments.
