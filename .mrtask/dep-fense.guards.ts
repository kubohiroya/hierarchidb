// Repository guard configuration using dep-fence guards
// Runs pre-commit/pre-push style validations without modifying your package policies.
// You can tweak severities and exclusions here.

import type { Rule } from 'dep-fence/guards';
import { pkgUiPeersRule, pkgExportsExistRule, tsconfigHygieneRule } from 'dep-fence/guards';

const rules: Rule[] = [
  // UI singletons must be peers; align tsup externals
  pkgUiPeersRule({
    exclude: ['@hierarchidb/app'],
    severity: { uiInDeps: 'error', uiMissingPeer: 'warn', peerNotExternal: 'warn', externalInDeps: 'warn' },
  }),

  // Verify package.json main/module/exports paths exist
  pkgExportsExistRule({ roots: ['packages', 'app'], action: 'error' }),

  // tsconfig baseline/JSX/skipLibCheck governance
  tsconfigHygieneRule({
    roots: ['packages', 'app'],
    requireBaseExtends: true,
    jsxShouldBe: 'react-jsx',
    skipLibCheck: {
      allowedPackages: [], // keep empty; rely on per-package checkDeps.allowSkipLibCheck
      action: 'error',
      requireReasonField: true,
    },
  }),
];

export default rules;
