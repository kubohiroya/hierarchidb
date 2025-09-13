// dep-fence 0.4.x configuration (ESM)
import { defaultPolicies } from 'dep-fence';
import fs from 'fs';
import path from 'path';

/**
 * Internal conventions for this monorepo
 * - Publishing: every package exposes types from dist/*.d.ts
 * - Authoring: tsconfig paths point to src entry files (never dist/*.d.ts)
 * - Consumption: apps and packages import only public entries (no deep src/dist imports)
 * - IDs: EntityId family is banned; use NodeId/TagId
 */

/** @type {import('dep-fence/types').Policy[]} */
const custom = [
  // Ban deprecated EntityId family (repo-specific rule)
  {
    id: 'ban-entityid-family',
    when: () => true,
    because: 'EntityId is deprecated. Use NodeId/TagId instead.',
    rules: [
      { rule: 'source-import-ban', options: { from: '@hierarchidb/common-type', names: ['EntityId', 'toEntityId', 'generateEntityId'] }, severity: 'ERROR' },
    ],
  },

  // Shared/common/runtime packages must not import node-type plugins (avoid dependency loops)
  {
    id: 'no-plugin-imports-from-shared',
    when: (ctx) => {
      const name = ctx.pkg?.name || '';
      return name.startsWith('@hierarchidb/runtime-') || name.startsWith('@hierarchidb/common-');
    },
    because: 'Shared/common/runtime packages must not depend on node-type plugins to avoid cycles.',
    rules: [
      { rule: 'import-path-ban', options: { forbid: ['^@hierarchidb/.+-plugin(?:/|$)'] }, severity: 'ERROR' },
    ],
  },

  // Ban per-package ambient shims (shims-*.d.ts) — centralize in common-type only
  {
    id: 'ban-local-ambient-shims',
    when: () => true,
    because: 'ローカルshimsは作成禁止。型は公開パッケージまたは共通ambientに集約する方針。',
    rules: [
      { rule: 'import-path-ban', options: { forbid: ['.*/src/.*/shims-.*\\.d\\.ts$'] }, severity: 'ERROR' },
    ],
  },

  // Ban importing *.d.ts from src (types must come from published dist or designated ambient)
  {
    id: 'ban-src-dts-imports',
    when: () => true,
    because: '型の横断参照はdist/*.d.ts か共通ambientのみ許可。src内の*.d.ts直参照を禁止。',
    rules: [
      { rule: 'import-path-ban', options: { forbid: ['.*/src/.*\\.d\\.ts$'] }, severity: 'ERROR' },
    ],
  },

  // Ban cross-package deep imports into src/dist internals (public API only)
  {
    id: 'ban-cross-package-deep-imports',
    when: () => true,
    because: '他パッケージの内部(src/dist)への深いimportは禁止。公開エントリのみ使用。',
    rules: [
      { rule: 'import-path-ban', options: { forbid: ['^packages/.+/(src|dist)/'], exceptSamePackage: true }, severity: 'ERROR' },
    ],
  },

  // Ban repo-local aliases in public entrypoints (keep publish surface portable)
  {
    id: 'ban-alias-in-public-entries',
    when: () => true,
    because: '公開エントリ(src/index.ts 等)でレポジトリアイリアス(~ 等)の使用を禁止。',
    rules: [
      { rule: 'import-path-ban', options: { from: ['**/src/index.ts', '**/src/ui/index.ts', '**/src/worker/index.ts'], forbid: ['^~/.+'] }, severity: 'ERROR' },
    ],
  },
];

// Refine default tsconfig policy to avoid false positives:
// - Check package-local tsconfig.json and ensure it extends repo base and sets jsx: 'react-jsx'.
// - If満たす場合のみ、既定のtsconfig-hygieneの検査をスキップ。
const patchedDefaults = defaultPolicies.map((p) => {
  if (p?.id !== 'tsconfig-hygiene') return p;
  const origWhen = p.when || (() => true);
  return {
    ...p,
    when: (ctx) => {
      try {
        const dir = ctx?.pkg?.dir || ctx?.dir || null;
        if (dir) {
          const tsconfigPath = path.join(dir, 'tsconfig.json');
          if (fs.existsSync(tsconfigPath)) {
            const ts = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
            const jsx = ts?.compilerOptions?.jsx;
            const ext = ts?.extends;
            const okExtends = typeof ext === 'string' && ext.includes('tsconfig.base.json');
            const okJsx = jsx === 'react-jsx' || jsx === 'react-jsxdev';
            if (okExtends && okJsx) {
              // Local tsconfig is already healthy; skip default hygiene for this pkg
              return false;
            }
          }
        }
      } catch {}
      return origWhen(ctx);
    },
  };
});

export const policies = [...patchedDefaults, ...custom];
export default policies;

// Optional configuration for scripts/dep-prune-report.mjs
// - Global ignore list for pruning report (dependencies to skip when checking usage)
export const pruneIgnore = [
  // Example: 'vite', 'vite-plugin-dts'
];
// - Per-package ignore list: { '<pkg-name>': ['depA','depB'] }
export const pruneIgnoreByPackage = {
  // Example: '@hierarchidb/app': ['vite']
};

// Shared policy options for extra dependency guards (scripts/dep-fence-extra.mjs)
export const policyOptions = {
  // Enforce workspace protocol for internal packages
  workspaceScopes: ['@hierarchidb'],
  // Enforce: react-router v7 must not depend on @types/react-router
  routerV7NoTypes: true,
  // MapLibre encapsulation: only these package names may directly depend on maplibre-gl / @vis.gl/react-maplibre
  mapLibreAllowedPackages: [
    '@hierarchidb/ui-map',
    '@hierarchidb/map-adapter',
  ],
  // UI peer policy: these should be peerDependencies (and optionally devDependencies for local dev)
  uiPeerLibs: ['react', 'react-dom', '@mui/material', '@emotion/react', '@emotion/styled'],
  // Check that tsup.external includes all peerDependencies
  checkTsupExternalizePeers: true,
};
