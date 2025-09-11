// dep-fence 0.4.x configuration (ESM)
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

  // Allow minimal, package-scoped ambient shims in node-type packages when used
  // solely for bridging optional peer types during DTS bundling (e.g., bootstrap hooks).
  // We still discourage UI package-local shims.
  {
    id: 'allow-node-type-ambient-shims',
    when: (ctx) => {
      const name = ctx.pkg?.name || '';
      return name.startsWith('@hierarchidb/') && name.includes('shape-plugin');
    },
    because: 'node-type packages may include narrow ambient d.ts for peer-only types to keep DTS bundling stable without enforcing install order.',
    rules: [
      { rule: 'local-shims-allow', options: { allow: ['**/src/types/shims-*.d.ts'] }, severity: 'INFO' },
    ],
  },
];

// Patch default policies: route-plugin provides both tsconfig.json and tsconfig.build.json
// but default tsconfig hygiene sometimes mis-detects JSX/extends. We scope-disable that
// specific default policy for the route-plugin only, leaving it active everywhere else.
const patchedDefaults = defaultPolicies.map((p) => {
  if (p?.id === 'tsconfig-hygiene') {
    const origWhen = p.when || (() => true);
    return {
      ...p,
      when: (ctx) => {
        const name = ctx.pkg?.name || '';
        if (name === '@hierarchidb/route-plugin') return false; // skip tsconfig hygiene for this pkg
        return origWhen(ctx);
      },
    };
  }
  return p;
});

export const policies = [...patchedDefaults, ...custom];
export default policies;
