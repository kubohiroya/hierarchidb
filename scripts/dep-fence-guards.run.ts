// Minimal guard runner for this repo.
// Usage:
//  pnpm run guards:pre-commit
//  pnpm run guards:pre-push
//  pnpm run guards:config -- --config .mrtask/dep-fense.guards.ts
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { GuardMode, Rule } from 'dep-fence/guards';

const mode = (process.argv.includes('--mode')
  ? (process.argv[process.argv.indexOf('--mode') + 1] as GuardMode)
  : 'pre-commit') as GuardMode;

const argIdx = process.argv.indexOf('--config');
const cfgRel = (argIdx > -1 ? process.argv[argIdx + 1] : process.env.DEP_FENSE_GUARDS) || '.mrtask/dep-fense.guards.ts';
const cfgPath = path.resolve(process.cwd(), cfgRel);

const { default: rules } = await import(pathToFileURL(cfgPath).toString());

const warnings: any[] = [];
const failures: any[] = [];
const ctx = {
  mode,
  cwd: process.cwd(),
  warn: (name: string, p: any) => warnings.push({ name, ...p }),
  fail: (name: string, p: any) => failures.push({ name, ...p }),
};

for (const r of (rules as Rule[])) {
  await Promise.resolve((r as any).run(ctx)).catch((e: any) => {
    failures.push({ name: (r as any).name || 'guard', message: e?.message ?? String(e) });
  });
}

for (const w of warnings) {
  console.warn(`WARN [${w.name}] ${w.message}`);
  if (w.files?.length) w.files.forEach((f: string) => console.warn(`  - ${f}`));
}
if (failures.length) {
  for (const f of failures) {
    console.error(`ERROR [${f.name}] ${f.message}`);
    if (f.files?.length) f.files.forEach((ff: string) => console.error(`  - ${ff}`));
  }
  process.exit(1);
}

console.log(`dep-fence guards: ${mode} OK`);
