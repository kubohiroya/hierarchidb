#!/usr/bin/env node
import { runWithPolicies, defaultPolicies } from '../packages/tools/check-deps/dist/index.js';

const findings = runWithPolicies(defaultPolicies);
const offenders = findings.filter(f => f.rule === 'maplibre-direct-dep' && f.severity === 'ERROR');
if (offenders.length) {
  console.error('MapLibre encapsulation violations found:');
  for (const f of offenders) {
    console.error(`- ${f.packageName}: ${f.message}`);
  }
  process.exit(1);
} else {
  console.log('No MapLibre encapsulation violations.');
}
