#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const outDir = path.join(ROOT, 'artifacts');
fs.mkdirSync(outDir, { recursive: true });

// Ensure package is built
spawnSync('pnpm', ['--filter', '@hierarchidb/check-deps', 'build'], { stdio: 'inherit' });

// Run checker in JSON mode
const res = spawnSync('node', ['packages/tools/check-deps/dist/cli.js', '--json'], { encoding: 'utf8' });
const json = res.stdout || '{}';
fs.writeFileSync(path.join(outDir, 'check-deps.json'), json);

let data;
try { data = JSON.parse(json); } catch { data = { findings: [] }; }
const findings = data.findings || [];

const byRule = new Map();
for (const f of findings) {
  const arr = byRule.get(f.rule) || [];
  arr.push(f);
  byRule.set(f.rule, arr);
}

let md = '# Policy Findings Summary\n\n';
md += `Total findings: ${findings.length}\n\n`;
md += '## By Rule\n';
for (const [rule, arr] of Array.from(byRule.entries()).sort((a, b) => b[1].length - a[1].length)) {
  md += `- ${rule}: ${arr.length}\n`;
}
md += '\n## Top Packages (by findings)\n';
const byPkg = new Map();
for (const f of findings) {
  const n = byPkg.get(f.packageName) || 0;
  byPkg.set(f.packageName, n + 1);
}
for (const [pkg, cnt] of Array.from(byPkg.entries()).sort((a, b) => b[1] - a[1]).slice(0, 30)) {
  md += `- ${pkg}: ${cnt}\n`;
}

fs.writeFileSync(path.join(outDir, 'check-deps-summary.md'), md);
console.log(md);

