import { runWithPolicies } from '../packages/tools/check-deps/dist/index.js';
import { defaultPolicies } from '../packages/tools/check-deps/dist/index.js';

const findings = await runWithPolicies(process.cwd(), defaultPolicies);
const offenders = findings.filter(
  (f) => f.rule === 'mui-x-date-pickers-direct-dep' && f.severity === 'ERROR',
);

if (offenders.length) {
  console.error('\n[Policy] Direct usage of @mui/x-date-pickers detected (forbidden).');
  for (const o of offenders) {
    console.error(`- ${o.packageName}: ${o.message}`);
  }
  process.exit(1);
}

console.log('[Policy] @mui/x-date-pickers encapsulation OK');

