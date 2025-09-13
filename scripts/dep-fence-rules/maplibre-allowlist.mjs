/**
 * dep-fence custom rule (proposal): maplibre-allowlist
 * Allows only specified packages to declare direct dependencies on
 *   - 'maplibre-gl'
 *   - '@vis.gl/react-maplibre'
 *
 * Options:
 *   { allow: string[] }  // package names allowed to depend on the above
 *
 * Example wiring (conceptual):
 *   import { maplibreAllowlist } from 'dep-fence-rules/maplibre-allowlist';
 *   policies.push(maplibreAllowlist({ allow: ['@scope/ui-map', '@scope/feature-map-adapter'] }));
 */

export const id = 'maplibre-allowlist';
export const meta = {
  docs: 'Only specific packages may directly depend on MapLibre stack.',
};

/**
 * @param {{ allow: string[] }} options
 * @returns {(ctx: { pkg: any, dir: string, report: (v:{message:string,severity?:'ERROR'|'WARN', where?:string})=>void })=>void}
 */
export function create(options = {}) {
  const allow = new Set(Array.isArray(options.allow) ? options.allow : []);
  const targets = ['maplibre-gl', '@vis.gl/react-maplibre'];
  return function check(ctx) {
    const pkg = ctx.pkg || {};
    const fields = ['dependencies', 'peerDependencies', 'devDependencies', 'optionalDependencies'];
    const found = [];
    for (const f of fields) {
      const obj = pkg[f] || {};
      for (const t of targets) if (obj[t]) found.push(t);
    }
    if (found.length === 0) return;
    if (!allow.has(pkg.name)) {
      ctx.report({
        message: `${pkg.name}: disallowed direct dependency on ${found.join(', ')}. Allowed: ${Array.from(allow).join(', ')}`,
        severity: 'ERROR',
        where: 'package.json',
      });
    }
  };
}

// Helper to produce a Policy-like wrapper for easy inclusion in dep-fence.config.mjs
export function asPolicy(options = {}) {
  const check = create(options);
  return {
    id,
    when: () => true,
    because: meta.docs,
    // Adapter layer: dep-fence core would iterate packages and call this function
    // Here we expose a generic entry for host integration.
    __check__: check,
  };
}

