# Dep‑Fence: Dependency Rules That Match How You Build Software

Why this tool? (Positioning and differences)
- What it is
  - A fast, rule‑based guardrail for your import/dependency graph. It lets you encode architectural boundaries (layers, public APIs, allowed directions) and fails CI when code crosses them.
- Problems it solves
  - Deep import leaks (importing a package’s internals instead of its public entry).
  - Layer violations (feature ↔ core, UI ↔ domain, backend ↔ frontend mixing).
  - Accidental cross‑package coupling in monorepos.
  - Enforcing publish‑time contracts (types must come from dist, no local aliases in public entrypoints).
- How it differs and how to combine
  - ESLint: focuses on code style and per‑file AST rules. Use ESLint for code smells; use Dep‑Fence for repository‑wide dependency edges. They complement each other.
  - madge / dependency-cruiser: great for visualizing graphs and flexible policies. Use them for exploration and complex graph analysis; use Dep‑Fence when you want a lightweight, opinionated, CI‑first policy engine with simple “from → to is (not) allowed” rules and ergonomic monorepo patterns.
  - syncpack: standardizes versions and workspace ranges in package.json. Keep using syncpack for manifest hygiene; Dep‑Fence governs runtime/build‑time import edges.
  - publint: validates published package shape (exports, files, types). publint protects consumers on npm; Dep‑Fence keeps your source code respecting internal boundaries before you publish.

🚀 Quick Start
- Install
  - pnpm add -D dep-fence
  - Or: npm i -D dep-fence / yarn add -D dep-fence
- Minimal config (drop one of these in repo root)

  MJS
  export default {
    rules: [
      // Disallow deep imports into other packages’ source
      { from: "packages/*/src/**", to: "packages/*/(src|dist)/**", forbid: true, exceptSamePackage: true },
      // Allow normal package entry usage
      { from: "**", to: "{@org/*,*}", allow: true }
    ]
  };

  TS
  import type { Config } from "dep-fence";
  const config: Config = {
    rules: [
      { from: "packages/*/src/**", to: "packages/*/(src|dist)/**", forbid: true, exceptSamePackage: true },
      { from: "**", to: "{@org/*,*}", allow: true }
    ]
  };
  export default config;

- Run
  - npx dep-fence
  - With strict exit code: npx dep-fence --strict
- Expected output (no violations)
  - ✅ No violations found (0 rules violated)
- In CI
  - Add: dep-fence --strict to your test/lint job

📌 リポジトリ運用メモ（2025-10-30 更新）
- 追加ガードは `pnpm run guard:deps:extra` で実行してください。`scripts/run-dependency-guard.mjs` が `verify-deps-before-run` / `_jsr-registry` など npm 固有の環境設定を事前に除去し、`Dependency guard passed with 0 warning(s).` 以外の警告が出ないようにしています。
- `npm run …` から直接呼び出すと npm CLI が未知の設定として警告を出すため、必ず pnpm 経由のラッパー（もしくは `node scripts/run-dependency-guard.mjs`）を利用してください。

🧩 Representative Policy Examples (Purpose → Snippet → Outcome)

- Public API only (ban deep imports across packages)
  - Purpose: Only allow package root imports (e.g., @org/foo, not @org/foo/src/x).
  - Snippet:
    { from: "**", to: "{**/src/**,**/internal/**}", forbid: true, exceptSamePackage: true }
  - Outcome: Any cross‑package deep path triggers a violation; same‑package internals remain allowed.

- Enforce types from dist
  - Purpose: Published “types” must come from dist/*.d.ts; prevent leaking src types across packages.
  - Snippet:
    { from: "**/*.ts", to: "**/src/**/*.d.ts", forbid: true }
    { from: "**/*.ts", to: "**/dist/**/*.d.ts", allow: true }
  - Outcome: Imports of .d.ts from src produce violations; dist types are allowed.

- Layered architecture (domain ← app; UI cannot import domain directly)
  - Purpose: Keep dependency direction clean.
  - Snippet:
    { from: "packages/ui/**", to: "packages/domain/**", forbid: true }
    { from: "packages/app/**", to: "packages/ui/**", allow: true }
    { from: "packages/app/**", to: "packages/domain/**", allow: true }
  - Outcome: UI code can’t pull domain directly; app orchestrates both.

- Allow test‑only exceptions
  - Purpose: Let tests reach into internals without weakening production code.
  - Snippet:
    { from: "**/*.test.{ts,tsx,js,jsx}", to: "**/src/**", allow: true }
  - Outcome: Deep imports are okay in tests, still forbidden elsewhere.

- No local alias leakage in public entries
  - Purpose: Public entry files must not rely on repo‑only aliases like "~/".
  - Snippet:
    { from: ["**/src/RuntimeWorkerService.ts", "**/src/ui/RuntimeWorkerService.ts", "**/src/worker/RuntimeWorkerService.ts"], to: "~/**", forbid: true }
  - Outcome: Publishing surface stays clean and portable.

🔎 What It Checks (conceptual)
- Dep‑Fence walks your import graph (static imports, re‑exports, type‑only, and configurable globs).
- Each edge is evaluated against ordered rules:
  - Matchers: from (origin file glob), to (target module/path glob)
  - Flags: allow/forbid, exceptSamePackage, test-only exceptions, typesOnly, devOnly
- First matching rule wins. If none match, default is allow (configurable).
- Reports concise violations with from → to, rule, and file/line (when available).

✅ Best Practices
- Start narrow: ban cross‑package deep imports first; then add layers.
- Keep rules close to your repo’s language: use workspace globs like packages/*/**.
- Prefer allow‑by‑default + explicit forbids (simpler mental model).
- Treat exceptions as temporary: add comments/TODOs and remove them after refactor.
- Run in CI with --strict; locally run without it for faster iteration.

🛠️ Advanced Settings
- Configuration formats: TS vs MJS
  - TS pros: types/completion, refactors well; cons: needs ts‑node/loader or ESM support in your toolchain.
  - MJS pros: zero‑setup in Node ESM; cons: no type safety in the file itself.
  - Recommendation: prefer MJS if you want zero friction in CI; prefer TS if your team values typed configs and your toolchain already runs TS configs.
- Performance and caching
  - Scope runs using changed files in CI (many CIs expose touched file lists).
  - Coarse‑grain rules (fewer globs) are faster than many tiny rules.
- Monorepo scoping
  - One config at the root is typical; you can also place configs in sub‑trees for team autonomy. Deeper configs override parent intent for their subtree.

🧯 Troubleshooting
- False positive: path aliases
  - Ensure the resolver mirrors your tsconfig paths/vite aliases. Configure dep‑fence resolve options accordingly.
- Types‑only import flagged
  - Use a rule with typesOnly: true (or exclude .d.ts targets if that’s your policy).
- Dynamic import
  - Dynamic and computed paths may be skipped or treated conservatively. Prefer explicit import paths for critical edges.
- It says a DB/index already exists in tests
  - Your test DB may reuse a name. Use unique per‑test DB names or a reset hook in your core DB helper.

❓ FAQ
- ESLint or Dep‑Fence?
  - Both. ESLint = code correctness/style within a file; Dep‑Fence = architectural boundaries across files/packages.
- Why not only dependency‑cruiser?
  - dependency‑cruiser is fantastic for exploration and can enforce rules; Dep‑Fence opts for a smaller surface, opinionated monorepo ergonomics, and CI‑first workflow with simple allow/forbid semantics many teams can adopt quickly.
- How do we introduce it gradually?
  - Start with warnings (no --strict). Add one or two forbid rules. Fix violations in a small slice, then tighten.
- Can we allow a one‑off?
  - Add an allow rule scoped to a precise from glob/file and remove it after refactor.
- How to protect publish contracts?
  - Combine Dep‑Fence (no deep imports, no repo‑local aliases in entrypoints, types from dist) with publint (package export surface), and run both in CI.

📦 Copy‑paste Examples

- dep-fence.config.mjs (layered + deep-import ban + tests exception)
export default {
  rules: [
    // 1) Ban deep imports across packages
    { from: "packages/*/src/**", to: "packages/*/(src|dist)/**", forbid: true, exceptSamePackage: true },

    // 2) Enforce layers (ui and domain can only be consumed by app)
    { from: "packages/ui/**", to: "packages/domain/**", forbid: true },
    { from: "packages/*/**", to: "packages/app/**", forbid: true },

    // 3) Allow tests to reach internals
    { from: "**/*.test.{ts,tsx,js,jsx}", to: "**/src/**", allow: true },

    // 4) Default allow for normal package entry imports
    { from: "**", to: "{@org/*,*}", allow: true }
  ]
};

- dep-fence.config.ts (typed)
import type { Config } from "dep-fence";
const config: Config = {
  rules: [
    { from: "packages/*/src/**", to: "packages/*/(src|dist)/**", forbid: true, exceptSamePackage: true },
    { from: "packages/ui/**", to: "packages/domain/**", forbid: true },
    { from: "packages/*/**", to: "packages/app/**", forbid: true },
    { from: "**/*.test.{ts,tsx,js,jsx}", to: "**/src/**", allow: true },
    { from: "**", to: "{@org/*,*}", allow: true }
  ]
};
export default config;

- CI snippet (GitHub Actions)
- name: Dep-Fence
  run: npx dep-fence --strict

- Typical outputs
✔ No violations (0)
✖ Violations (2)
 • from: packages/ui/button/src/useX.ts → to: packages/domain/src/private/db.ts (rule: deep-imports forbidden)
 • from: packages/features/x/src/RuntimeWorkerService.ts → to: @org/app (rule: layer: no upward imports)

🎯 Mental model
- Treat Dep‑Fence as your “import firewall.” Write a few high‑signal rules that capture your architecture, run it on every PR, and let developers focus on features without accidentally dissolving your boundaries.
