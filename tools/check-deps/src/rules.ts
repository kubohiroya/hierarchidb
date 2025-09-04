import fs from 'node:fs';
import path from 'node:path';
import { readTsconfig, readTsupExternals } from './loaders';
import type { Finding, Severity } from './types';

const UI_PEERS = [
  'react',
  'react-dom',
  '@mui/material',
  '@mui/icons-material',
  '@emotion/react',
  '@emotion/styled',
];

export interface RuleContext {
  pkgName: string;
  pkgDir: string;
  pkgJson: any;
  defaultsExternals: string[];
  allowSkipLibCheck: Set<string>;
  because?: string; // populated by policy engine
}

function push(findings: Finding[], ctx: RuleContext, rule: string, severity: Severity, message: string) {
  findings.push({ packageName: ctx.pkgName, packageDir: ctx.pkgDir, rule, severity, message, because: ctx.because });
}

export function runRules(ctx: RuleContext): Finding[] {
  const f: Finding[] = [];
  const deps = new Set(Object.keys(ctx.pkgJson.dependencies || {}));
  const peers = new Set(Object.keys(ctx.pkgJson.peerDependencies || {}));
  const devs = new Set(Object.keys(ctx.pkgJson.devDependencies || {}));
  const externals = new Set(readTsupExternals(ctx.pkgDir, ctx.defaultsExternals));
  const tsconfig = readTsconfig(ctx.pkgDir);
  const paths = (tsconfig.compilerOptions && tsconfig.compilerOptions.paths) || {};

  // 1) peer ⊆ external
  const missingExternal = [...peers].filter((p) => !externals.has(p));
  if (missingExternal.length) push(f, ctx, 'peer-in-external', 'WARN', `peer not in tsup.external:\n- ${missingExternal.join('\n- ')}`);

  // 2) external ∩ dependencies（peer でない）
  const extInDepsNotPeers = [...externals].filter((e) => deps.has(e) && !peers.has(e));
  if (extInDepsNotPeers.length) push(f, ctx, 'external-in-deps', 'WARN', `external also in dependencies (consider peer):\n- ${extInDepsNotPeers.join('\n- ')}`);

  // 3) UI系: dependencies に置かない
  const uiInDeps = UI_PEERS.filter((u) => deps.has(u));
  if (uiInDeps.length) push(f, ctx, 'ui-in-deps', 'ERROR', `UI libs should be peerDependencies (not dependencies):\n- ${uiInDeps.join('\n- ')}`);
  const uiMissingPeer = UI_PEERS.filter((u) => (deps.has(u) || devs.has(u)) && !peers.has(u));
  if (uiMissingPeer.length) push(f, ctx, 'ui-missing-peer', 'WARN', `UI libs installed but missing in peerDependencies:\n- ${uiMissingPeer.join('\n- ')}`);

  // 4) tsconfig.paths 直参照 ../xxx/src
  const badPaths = Object.entries(paths)
    .flatMap(([k, arr]) => (arr as string[] || []).map((p) => ({ key: k, val: p })))
    .filter((e) => /\.\.\/.+\/src(\/|$)/.test(e.val));
  if (badPaths.length) push(
    f, ctx, 'paths-direct-src', 'WARN',
    `tsconfig paths direct src reference:\n- ${badPaths.map((e) => `${e.key} -> ${e.val}`).join('\n- ')}`
  );

  // 4b) tsconfig.paths が他パッケージの dist/*.d.ts を直接参照
  const pathsToDistDts = Object.entries(paths)
    .flatMap(([k, arr]) => (arr as string[] || []).map((p) => ({ key: k, val: p })))
    .filter((e) => /\/dist\/.+\.d\.ts$/.test(e.val));
  if (pathsToDistDts.length) push(
    f, ctx, 'paths-to-dist-dts', 'ERROR',
    `tsconfig paths pointing to built d.ts is forbidden (use workspace deps + package types or TS project refs):\n- ${pathsToDistDts.map((e) => `${e.key} -> ${e.val}`).join('\n- ')}`
  );

  // 5) ローカル shim 検出
  const shimDir = path.join(ctx.pkgDir, 'src', 'types');
  if (fs.existsSync(shimDir)) {
    const shims = fs.readdirSync(shimDir).filter((fn) => fn.endsWith('.d.ts'));
    if (shims.length) push(f, ctx, 'local-shims', 'WARN', `local type shims present (document policy):\n- ${shims.join('\n- ')}`);
  }

  // 6) skipLibCheck ポリシング
  const skip = !!(tsconfig.compilerOptions && tsconfig.compilerOptions.skipLibCheck);
  const allowInTs = !!(tsconfig.checkDeps && tsconfig.checkDeps.allowSkipLibCheck);
  if (skip) {
    if (ctx.allowSkipLibCheck.has(ctx.pkgName) || allowInTs) {
      const reason = (tsconfig.checkDeps && tsconfig.checkDeps.reason) || '';
      if (!reason && !ctx.allowSkipLibCheck.has(ctx.pkgName)) push(f, ctx, 'skipLibCheck-no-reason', 'WARN', 'skipLibCheck enabled without documented reason.');
    } else {
      push(f, ctx, 'skipLibCheck-not-allowed', 'ERROR', 'skipLibCheck is enabled but not allowed.');
    }
  }

  // 7) tsconfig extends base
  const ext = tsconfig.extends || '';
  if (!ext.includes('tsconfig.base.json')) push(f, ctx, 'tsconfig-no-base', 'WARN', `tsconfig does not extend repo base (tsconfig.base.json): ${ext || '(missing)'} `);

  // 8) tsx があるなら jsx: react-jsx
  let hasTsx = false;
  const src = path.join(ctx.pkgDir, 'src');
  const stack = [src];
  while (stack.length && !hasTsx) {
    const d = stack.pop();
    if (!d || !fs.existsSync(d)) break;
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      if (ent.isDirectory()) stack.push(path.join(d, ent.name));
      else if (ent.name.endsWith('.tsx')) { hasTsx = true; break; }
    }
  }
  const jsxOpt = tsconfig.compilerOptions && tsconfig.compilerOptions.jsx;
  if (hasTsx && jsxOpt !== 'react-jsx') push(f, ctx, 'jsx-mismatch', 'WARN', `tsx files detected but compilerOptions.jsx is '${jsxOpt || '(unset)'}' (recommend 'react-jsx').`);

  return f;
}

// Export individual rule runners with ids so a policy can select them
export type RuleRunner = (ctx: RuleContext) => Finding[];

// Simple wrappers to reuse runRules but filter by rule ids afterwards
function only(ruleIds: Set<string>, fn: RuleRunner): RuleRunner {
  return (ctx) => fn(ctx).filter((x) => ruleIds.has(x.rule));
}

// registry mapping rule id -> runner that emits only that rule
export const ruleRegistry: Record<string, RuleRunner> = {
  'peer-in-external': only(new Set(['peer-in-external']), runRules),
  'external-in-deps': only(new Set(['external-in-deps']), runRules),
  'ui-in-deps': only(new Set(['ui-in-deps']), runRules),
  'ui-missing-peer': only(new Set(['ui-missing-peer']), runRules),
  'paths-direct-src': only(new Set(['paths-direct-src']), runRules),
  'paths-to-dist-dts': only(new Set(['paths-to-dist-dts']), runRules),
  'local-shims': only(new Set(['local-shims']), runRules),
  'skipLibCheck-no-reason': only(new Set(['skipLibCheck-no-reason']), runRules),
  'skipLibCheck-not-allowed': only(new Set(['skipLibCheck-not-allowed']), runRules),
  'tsconfig-no-base': only(new Set(['tsconfig-no-base']), runRules),
  'jsx-mismatch': only(new Set(['jsx-mismatch']), runRules),
};
