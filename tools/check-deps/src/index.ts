#!/usr/bin/env ts-node
import { policies } from './config';
import { runWithPolicies } from './engine';
import { printFindings } from './reporters';

function main() {
  const findings = runWithPolicies(policies);
  printFindings(findings);
  const hasError = findings.some((f) => f.severity === 'ERROR');
  if (process.argv.includes('--strict') && hasError) process.exit(1);
}

main();

