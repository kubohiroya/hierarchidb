#!/usr/bin/env node
import { globby } from 'globby';

const patterns = ['packages/ui/*/src/**/use*.tsx'];
const ignore = ['**/*.test.tsx', '**/*.stories.tsx'];

const offenders = await globby(patterns, {
  gitignore: true,
  ignore,
});

if (offenders.length === 0) {
  console.log('[policy] OK: no UI hook files matched packages/ui/*/src/**/use*.tsx');
  process.exit(0);
}

console.error('[policy] ERROR: disallowed UI hook tsx files detected (hooks must be .ts without JSX):');
for (const file of offenders.sort()) {
  console.error(`- ${file}`);
}
process.exit(1);
