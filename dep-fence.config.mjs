// dep-fence 0.4.x configuration (ESM)
import { defaultPolicies } from 'dep-fence';
import fs from 'fs';
import path from 'path';

function readJsonLoose(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const sanitized = raw
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|\s+)\/\/.*$/gm, '')
      .replace(/,(\s*[}\]])/g, '$1');
    return JSON.parse(sanitized);
  } catch {
    return null;
  }
}

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
      { rule: 'source-import-ban', options: { from: '@hierarchidb/common-types', names: ['EntityId', 'toEntityId', 'generateEntityId'] }, severity: 'ERROR' },
    ],
  },

  // Shared/common/runtime packages must not import node-type plugin-loader (avoid dependency loops)
  {
    id: 'no-plugin-imports-from-shared',
    when: (ctx) => {
      const name = ctx.pkg?.name || '';
      return name.startsWith('@hierarchidb/runtime-') || name.startsWith('@hierarchidb/common-');
    },
    because: 'Shared/common/runtime packages must not depend on node-type plugin-loader to avoid cycles.',
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

  // App must rely on the dialog host facade to interact with plugins
  {
    id: 'app-plugin-dialog-layering',
    when: (ctx) => ctx.pkg?.name === '@hierarchidb/app',
    because: 'App must interact with plugin dialogs via @hierarchidb/plugin-ui-host facade.',
    rules: [
      {
        rule: 'import-path-ban',
        options: {
          forbid: [
            '^@hierarchidb/plugin-base(?:/|$)',
            '^@hierarchidb/plugin-service-(?:api|sdk)(?:/|$)',
          ],
          message: 'Use @hierarchidb/plugin-ui-host/PluginDialogHost instead of {importPath}.',
        },
        severity: 'ERROR',
      },
    ],
  },
  {
    id: 'app-ui-shell-bundle',
    when: (ctx) => ctx.pkg?.name === '@hierarchidb/app',
    because: 'App UI imports should go through @hierarchidb/ui-shell facades.',
    rules: [
      {
        rule: 'import-path-ban',
        options: {
          forbid: [
            '^@hierarchidb/(components|plugin-ui-host|ui-auth|ui-core|ui-dialog|ui-icon|ui-i18n|ui-layout|ui-map|ui-navigation|ui-routing|ui-theme|ui-tour|ui-treeconsole-(?:base|breadcrumb|toolbar|treetable)|ui-usermenu)(?:/|$)',
          ],
          message: 'Use @hierarchidb/ui-shell/{module} instead of {importPath}.',
        },
        severity: 'ERROR',
      },
    ],
  },
  {
    id: 'app-feature-core-bundle',
    when: (ctx) => ctx.pkg?.name === '@hierarchidb/app',
    because: 'App feature/data imports should go through @hierarchidb/feature-core facades.',
    rules: [
      {
        rule: 'import-path-ban',
        options: {
          forbid: [
            '^@hierarchidb/(common-(?:api|auth|types)|util|runtime-(?:client|worker)|plugin-(?:presentation|registry|ui-sdk)|map-adapter|(?:basemap|folder|linker|location|resolver|route|shape|spreadsheet|styler|timeline)-plugin|tabular-source-xlsx)(?:/|$)',
          ],
          message: 'Use @hierarchidb/feature-core/{module} instead of {importPath}.',
        },
        severity: 'ERROR',
      },
    ],
  },

  // plugin-base must stay UI-headless (no worker/service SDK dependencies)
  {
    id: 'plugin-base-headless-guard',
    when: (ctx) => ctx.pkg?.name === '@hierarchidb/plugin-base',
    because: 'plugin-base is the headless UI layer; worker/service integrations belong in plugin-service-sdk or host packages.',
    rules: [
      {
        rule: 'import-path-ban',
        options: {
          forbid: [
            '^@hierarchidb/runtime-client(?:/|$)',
            '^@hierarchidb/plugin-service-(?:api|sdk)(?:/|$)',
            '^@hierarchidb/common-api(?:/|$)',
            '^comlink(?:/|$)',
          ],
        },
        severity: 'ERROR',
      },
    ],
  }
];

// Refine default tsconfig policy to avoid false positives:
// - Check package-local tsconfig.json and ensure it extends repo base and sets jsx: 'react-jsx'.
// - If満たす場合のみ、既定のtsconfig-hygieneの検査をスキップ。
const defaultPolicyAllowlist = new Set([
  'publishable-tsconfig-hygiene',
  'publishable-local-shims',
  'skipLibCheck-governance',
  'non-ui-paths-hygiene',
  'maplibre-encapsulation',
]);

const patchedDefaults = defaultPolicies
  .filter((policy) => defaultPolicyAllowlist.has(policy.id))
  .map((policy) => {
    if (policy.id !== 'publishable-tsconfig-hygiene') return policy;

    const origWhen = policy.when || (() => true);
    return {
      ...policy,
      when: (ctx) => {
        const dir = ctx?.pkg?.dir || ctx?.dir || null;
        if (dir) {
          const tsconfigPath = path.join(dir, 'tsconfig.json');
          if (fs.existsSync(tsconfigPath)) {
            const ts = readJsonLoose(tsconfigPath);
            const jsx = ts?.compilerOptions?.jsx;
            const ext = ts?.extends;
            const okExtends = typeof ext === 'string' && ext.includes('tsconfig.base.json');
            const okJsx = jsx === 'react-jsx' || jsx === 'react-jsxdev' || jsx === undefined;
            if (okExtends && okJsx) {
              return false;
            }
          }
        }
        return origWhen(ctx);
      },
    };
  });

export const policies = [...patchedDefaults, ...custom];

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
  // UI peer policy: these should be peerDependencies (and optionally devDependencies for local dev)
  // Also used to verify no package ships its own copy (externalize in tsup)
  uiPeerLibs: [
    'react',
    'react-dom',
    'react-router',
    'react-router-dom',
    'jotai',
    '@mui/material',
    '@emotion/react',
    '@emotion/styled',
  ],
};
