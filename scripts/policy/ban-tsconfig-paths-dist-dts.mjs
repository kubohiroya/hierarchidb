#!/usr/bin/env node
import { globby } from 'globby';
import fs from 'fs';

/**
 * Policy (legacy): ban tsconfig.paths entries that reference dist/*.d.ts
 *
 * NOTE:
 * This repo now enforces the rule:
 *   - Vite dev reads src (HMR)
 *   - TypeScript typecheck reads dist (public types)
 *
 * Therefore, dist/*.d.ts references in tsconfig paths are not a policy violation.
 * The real guardrails are enforced by:
 *   - policy:ban-tsconfig-paths-src (no packages/plugins src)
 *   - build:types + typecheck order (turbo)
 *
 * This script is kept for backward compatibility and will always PASS.
 */

async function main() {
  // Keep a tiny scan as an informational metric (no failure).
  const files = await globby(['**/tsconfig*.json', '!**/node_modules/**', '!**/dist/**']);
  let hits = 0;
  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf8');
    if (/dist\/[\s\S]*\.d\.ts/.test(raw)) hits++;
  }
  console.log(`[policy] OK (disabled): dist/*.d.ts references are allowed (tsconfig should read dist). Checked ${files.length} tsconfig files; ${hits} contain 'dist/*.d.ts'.`);
}

main();
