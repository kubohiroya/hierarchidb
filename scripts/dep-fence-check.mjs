#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const cfgPath = path.resolve(process.cwd(), 'dep-fence.config.json');
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));

const glob = (pattern) => {
  // very small globber: only **/*.ts[x] patterns used in config
  const isTsx = pattern.endsWith('tsx');
  const base = pattern.replace(/\*\*\/.*$/, '');
  const root = base.endsWith('/') ? base.slice(0, -1) : base;
  const ext = isTsx ? '.tsx' : '.ts';
  const results = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === 'dist') continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && (p.endsWith(ext))) results.push(p);
    }
  };
  if (fs.existsSync(root)) walk(root);
  return results;
};

let violations = [];

for (const rule of cfg.rules) {
  if (rule.globs) {
    const files = rule.globs.flatMap(glob);
    const forbid = (rule.forbid || []).map((f) => new RegExp(
      f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\\\\\*\\\\\\*/g, '.*')
        .replace(/\\\\\*/g, '[^/]*')
    ));
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      const importRe = /from\s+['\"]([^'\"]+)['\"]/g;
      let m;
      while ((m = importRe.exec(src))) {
        const spec = m[1];
        if (forbid.some((rx) => rx.test(spec))) {
          violations.push({ rule: rule.name, file: f, spec, message: rule.message });
        }
      }
    }
  } else if (rule.packageJson) {
    const files = glob(rule.name === 'package-json' ? '**/package.json' : 'packages/node-type/*-plugin/package.json');
    for (const file of files) {
      const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
      for (const r of rule.packageJson.require || []) {
        const val = r.path.reduce((o, k) => (o ? o[k] : undefined), pkg);
        if (typeof val !== 'string' || !new RegExp(r.match).test(val)) {
          violations.push({ rule: rule.name, file, spec: r.path.join('.'), message: rule.message });
        }
      }
    }
  }
}

if (violations.length) {
  console.error('[dep-fence] violations:');
  for (const v of violations) console.error(`- (${v.rule}) ${v.file} -> ${v.spec}: ${v.message}`);
  process.exit(1);
}
console.log('[dep-fence] ok');
