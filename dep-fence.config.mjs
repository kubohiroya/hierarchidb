// dep-fence 0.2.x configuration (ESM)
import { defaultPolicies } from 'dep-fence';

/**
 * Internal conventions for this monorepo
 * - Publishing: every package exposes types from dist/*.d.ts
 * - Authoring: tsconfig paths point to src entry files (never dist/*.d.ts)
 * - Consumption: apps and packages import only public entries (no deep src/dist imports)
 * - IDs: EntityId family is banned; use NodeId/TagId
 */

/** @type {import('dep-fence/types').Policy[]} */
const custom = [
  // 1) Ban EntityId usage
  {
    id: 'ban-entityid-family',
    when: () => true,
    because: 'EntityId is deprecated. Use NodeId/TagId instead.',
    rules: [
      {
        rule: 'source-import-ban',
        options: { from: '@hierarchidb/common-type', names: ['EntityId', 'toEntityId', 'generateEntityId'] },
        severity: 'ERROR',
      },
    ],
  },

  // 2) tsconfig paths must not reference dist/*.d.ts
  {
    id: 'tsconfig-paths-no-dist',
    when: () => true,
    because: 'Do not put dist/*.d.ts in tsconfig paths; use src entry files.',
    rules: [
      {
        rule: 'tsconfig-paths',
        options: { forbidPattern: '/dist/.+\\.d\\.ts$', allowPattern: '/src/.+\\.ts$' },
        severity: 'ERROR',
      },
    ],
  },

  // 3) Packages must publish types from dist
  {
    id: 'package-types-to-dist',
    when: () => true,
    because: 'All packages publish types from dist/*.d.ts.',
    rules: [
      {
        rule: 'package-types-dist',
        options: { requireDistForEntries: ['.'] },
        severity: 'ERROR',
      },
    ],
  },

  // 4) Multi-entry plugins publish types from dist for their subpaths
  {
    id: 'multi-entry-types-to-dist',
    when: () => true,
    because: 'Subpaths like ./ui, ./shared, ./worker must use dist/*.d.ts if present.',
    rules: [
      {
        rule: 'package-types-dist',
        // Enforce dist for known subpaths and any additional exported subpaths.
        // './**' acts as a catch‑all for arbitrary entries declared in package.json exports.
        options: { requireDistForEntries: ['.', './ui', './shared', './worker', './**'] },
        severity: 'ERROR',
      },
    ],
  },


  // 5) No deep src/dist imports in source files (tests are exempt)
  {
    id: 'no-deep-imports-in-source',
    when: (ctx) => !(ctx.file?.path.match(/__tests__/)) && !(ctx.file?.path.match(/\.(test|spec)\.[tj]sx?$/)),
    because: 'Import only public package entries, not sibling src/ or dist/ internals.',
    rules: [
      {
        rule: 'import-path-ban',
        options: {
          forbid: [
            '^@hierarchidb/.+?/src(/|$)',
            '^@hierarchidb/.+?/dist(/|$)',
            '^\.\./packages/.+?/src(/|$)',
            '^\.\./packages/.+?/dist(/|$)'
          ],
        },
        severity: 'ERROR',
      },
    ],
  },

  // 6) App must not deep import sibling packages
  {
    id: 'app-no-deep-imports',
    when: (ctx) => ctx.pkg?.name === '@hierarchidb/app',
    because: 'App consumes only public APIs of workspace packages.',
    rules: [
      {
        rule: 'import-path-ban',
        options: {
          forbid: [
            '^@hierarchidb/.+?/src(/|$)',
            '^@hierarchidb/.+?/dist(/|$)',
            '^\.\./packages/.+?/src(/|$)',
            '^\.\./packages/.+?/dist(/|$)'
          ],
        },
        severity: 'ERROR',
      },
      // Also block relative hops to the repo root to avoid sneaking in local files
      {
        rule: 'import-path-ban',
        options: { forbid: ['^\.\./(?!node_modules/).+'] },
        severity: 'ERROR',
      },
    ],
  },

  // 7) Public entrypoints must not use repo-local aliases like '~/'
  {
    id: 'no-tilde-alias-in-public-entries',
    when: (ctx) => !!ctx.file?.path.match(/\/src\/(index|ui\/index|shared\/index|worker\/index)\.ts$/),
    because: 'Public export files must avoid repo-local path aliases.',
    rules: [
      {
        rule: 'file-content-ban',
        options: { pattern: '(^|\n)\s*import\s+.+?from\s+["\']~\/' },
        severity: 'ERROR',
      },
    ],
  },
];

export const policies = [...defaultPolicies, ...custom];
export default policies;
