/**
 * dep-fence custom rule (proposal): ui-peer-policy
 * Enforce that specified UI foundation libraries belong to peerDependencies (not dependencies).
 *
 * Options:
 *   { libs: string[] } // e.g., ['react','react-dom','@mui/material','@emotion/react','@emotion/styled']
 */

export const id = 'ui-peer-policy';
export const meta = {
  docs: 'UI foundation libraries must be peerDependencies (not bundled).',
};

/**
 * @param {{ libs: string[] }} options
 * @returns {(ctx: { pkg: any, dir: string, report: (v:{message:string,severity?:'ERROR'|'WARN', where?:string})=>void })=>void}
 */
export function create(options = {}) {
  const libs = Array.isArray(options.libs) ? options.libs : [];
  const libSet = new Set(libs);
  return function check(ctx) {
    const pkg = ctx.pkg || {};
    const deps = pkg.dependencies || {};
    const peers = pkg.peerDependencies || {};
    for (const lib of libSet) {
      if (deps[lib] && !peers[lib]) {
        ctx.report({
          message: `${pkg.name}: '${lib}' should be in peerDependencies (not dependencies).`,
          severity: 'ERROR',
          where: 'package.json',
        });
      }
    }
  };
}

export function asPolicy(options = {}) {
  const check = create(options);
  return {
    id,
    when: () => true,
    because: meta.docs,
    __check__: check,
  };
}

