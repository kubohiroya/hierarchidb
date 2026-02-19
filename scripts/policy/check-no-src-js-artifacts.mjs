#!/usr/bin/env node
import { execSync } from 'node:child_process';

const root = process.cwd();

function listUntracked() {
  const out = execSync('git ls-files --others --exclude-standard -- .', {
    encoding: 'utf8',
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const files = out
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return files.filter((file) => /(^|\/|\\)src(\/|\\).+\.(?:js|js\.map)$/.test(file));
}

const offenders = listUntracked();

if (offenders.length === 0) {
  process.stdout.write('[policy] no untracked src js artifacts found\n');
  process.exit(0);
}

console.error('[policy] ERROR: untracked js artifacts found under src/ during build');
for (const file of offenders) {
  console.error(`- ${file}`);
}
console.error('Run: git clean -fd <generated-paths> or remove these files before running pnpm build');
process.exit(1);
