#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = process.cwd();

function walk(dir, exts = ['.ts', '.tsx']) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (/^(dist|node_modules|\.mrtask|docs|__tests__|__mocks__|coverage|storybook-static)$/.test(ent.name)) continue;
      out.push(...walk(p, exts));
    } else {
      if (exts.includes(path.extname(p))) out.push(p);
    }
  }
  return out;
}

function collectExports(file) {
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split(/\r?\n/);
  const exports = [];
  const regexes = [
    [/export\s+interface\s+(\w+)/, 'interface'],
    [/export\s+type\s+(\w+)/, 'type'],
    [/export\s+class\s+(\w+)/, 'class'],
    [/export\s+function\s+(\w+)/, 'function'],
    [/export\s+const\s+(\w+)/, 'const'],
    [/export\s+enum\s+(\w+)/, 'enum'],
  ];
  lines.forEach((line, idx) => {
    for (const [re, kind] of regexes) {
      const m = line.match(re);
      if (m) exports.push({ name: m[1], kind, file, line: idx + 1 });
    }
  });
  return exports;
}

function rg(pattern, cwd, extraArgs = []) {
  const args = ['-n', '--json', '-S', pattern, '.'];
  const res = spawnSync('rg', [...args, ...extraArgs], { cwd, encoding: 'utf8' });
  return res.stdout || '';
}

function main() {
  const pkgDir = process.argv[2] || 'packages/plugins/folder-plugin';
  if (!fs.existsSync(pkgDir)) {
    console.error(`Package dir not found: ${pkgDir}`);
    process.exit(1);
  }
  const files = walk(path.join(pkgDir, 'src'));
  const allExports = files.flatMap(collectExports);

  const results = [];
  for (const ex of allExports) {
    const word = `\\b${ex.name}\\b`;
    const json = rg(word, repoRoot, ['-g', '!*dist/**', '-g', '!*node_modules/**']);
    const lines = json
      .trim()
      .split(/\n/)
      .filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean)
      .filter((e) => e.type === 'match');
    const hits = lines.filter((e) => path.resolve(e.data.path.text) !== path.resolve(ex.file));
    results.push({ ...ex, references: hits.map((h) => ({ file: h.data.path.text, line: h.data.line_number, text: h.data.lines.text.trim() })) });
  }

  // File-level import usage (approximate)
  const importHits = {};
  const importJson = rg('from\s+\"([^\"]+)\"|from\s+\'([^\']+)\'|import\s+\(', repoRoot, ['-g', '!*dist/**', '-g', '!*node_modules/**']);
  importJson.trim().split(/\n/).forEach((l) => {
    let obj; try { obj = JSON.parse(l); } catch { return; }
    if (obj.type !== 'match') return;
    const f = obj.data.path.text;
    importHits[f] = (importHits[f] || 0) + 1;
  });

  const fileUsage = files.map((f) => ({ file: f, referencedByImports: Object.prototype.hasOwnProperty.call(importHits, f) }));

  const unusedExports = results.filter((r) => r.references.length === 0);
  const unusedFiles = fileUsage.filter((u) => !u.referencedByImports);

  const out = { package: pkgDir, exports: results, unusedExports, unusedFiles };
  const outPath = path.join(pkgDir, 'UNUSED_REPORT.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));

  const md = [
    `# Unused Sweep Report (auto-generated)`,
    `- package: ${pkgDir}`,
    `- date: ${new Date().toISOString()}`,
    `\n## Unused Exports (0-ref across repo)`,
    ...unusedExports.map((u) => `- ${u.kind} ${u.name} (${path.relative(repoRoot, u.file)}:${u.line})`),
    `\n## Files Not Referenced In Imports (approx)`,
    ...unusedFiles.map((u) => `- ${path.relative(repoRoot, u.file)}`),
    `\n> Note: Heuristics only. Re-exports and dynamic usages may not be captured.`,
  ].join('\n');
  const mdPath = path.join(pkgDir, 'UNUSED_SWEEP_REPORT.md');
  fs.writeFileSync(mdPath, md);
  console.log(`Wrote ${outPath} and ${mdPath}`);
}

main();

