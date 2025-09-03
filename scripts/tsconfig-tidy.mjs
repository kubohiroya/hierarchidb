#!/usr/bin/env node
/*
  tsconfig-tidy.mjs
  - 目的: リポジトリ配下の tsconfig*.json を一括整備
    - jsx を react-jsx に統一 (--set-jsx)
    - skipLibCheck を削除 (--remove-skip-lib-check)
    - ルートの tsconfig.base.json へ extends を張る (--base <path>)
  - 使い方:
    node scripts/tsconfig-tidy.mjs \
      --base tsconfig.base.json \
      --set-jsx react-jsx \
      --remove-skip-lib-check \
      --dry  # 乾式実行
*/
import { promises as fs } from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] ?? true] : [a, true];
}));

const cwd = process.cwd();
const basePath = args.base ? path.resolve(cwd, String(args.base)) : null;
const setJsx = args['set-jsx'] ? String(args['set-jsx']) : 'react-jsx';
const removeSkip = Boolean(args['remove-skip-lib-check']);
const dryRun = Boolean(args['dry']);

const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.turbo', '.next', 'out']);

function stripJsonCommentsAndTrailingCommas(str) {
  // JSONC対応: 文字列は保持しつつ // と /* */ を除去し、末尾カンマも除去
  let out = '';
  let i = 0;
  let inStr = false;
  let strQuote = '';
  let escaped = false;
  let inLine = false;
  let inBlock = false;

  while (i < str.length) {
    const ch = str[i];
    const next = str[i + 1];

    if (inLine) {
      if (ch === '\n') { inLine = false; out += ch; }
      i++;
      continue;
    }
    if (inBlock) {
      if (ch === '*' && next === '/') { inBlock = false; i += 2; continue; }
      i++;
      continue;
    }

    if (inStr) {
      out += ch;
      if (escaped) { escaped = false; }
      else if (ch === '\\') { escaped = true; }
      else if (ch === strQuote) { inStr = false; strQuote = ''; }
      i++;
      continue;
    }

    if (ch === '"' || ch === '\'') {
      inStr = true; strQuote = ch; out += ch; i++; continue;
    }

    if (ch === '/' && next === '/') { inLine = true; i += 2; continue; }
    if (ch === '/' && next === '*') { inBlock = true; i += 2; continue; }

    out += ch; i++;
  }

  // 末尾カンマ除去（文字列外のみ）
  let res = '';
  inStr = false; strQuote = ''; escaped = false;
  for (let j = 0; j < out.length; j++) {
    const c = out[j];
    if (inStr) {
      res += c;
      if (escaped) { escaped = false; }
      else if (c === '\\') { escaped = true; }
      else if (c === strQuote) { inStr = false; strQuote = ''; }
      continue;
    }
    if (c === '"' || c === '\'') { inStr = true; strQuote = c; res += c; continue; }
    if (c === ',') {
      let k = j + 1;
      while (k < out.length && /\s/.test(out[k])) k++;
      if (out[k] === ']' || out[k] === '}') { j = k - 1; continue; }
    }
    res += c;
  }
  return res;
}

async function findFiles(dir, acc) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory()) {
      if (IGNORE_DIRS.has(e.name)) continue;
      await findFiles(path.join(dir, e.name), acc);
    } else if (e.isFile()) {
      const name = e.name.toLowerCase();
      if (name === 'tsconfig.json' || (name.startsWith('tsconfig') && name.endsWith('.json'))) {
        acc.push(path.join(dir, e.name));
      }
    }
  }
}

function stableStringify(obj) {
  return JSON.stringify(obj, null, 2) + '\n';
}

async function main() {
  const files = [];
  await findFiles(cwd, files);
  if (files.length === 0) {
    console.log('No tsconfig*.json found.');
    return;
  }

  console.log(`Found ${files.length} tsconfig file(s).`);
  for (const file of files) {
    const raw = await fs.readFile(file, 'utf8');
    let jsonText = stripJsonCommentsAndTrailingCommas(raw);
    let data;
    try {
      data = JSON.parse(jsonText);
    } catch (e) {
      console.error(`Failed to parse ${file}:`, e.message);
      continue;
    }

    const before = JSON.stringify(data);

    data.compilerOptions = data.compilerOptions || {};

    if (setJsx) {
      if (data.compilerOptions.jsx !== setJsx) {
        data.compilerOptions.jsx = setJsx;
      }
    }

    if (removeSkip && 'skipLibCheck' in data.compilerOptions) {
      delete data.compilerOptions.skipLibCheck;
    }

    if (basePath) {
      // 自身が base ファイルそのものなら extends 設定は触らない
      const absFile = path.resolve(file);
      if (path.normalize(absFile) !== path.normalize(basePath)) {
        try {
          await fs.access(basePath);
          const rel = path
            .relative(path.dirname(absFile), basePath)
            .replace(/\\/g, '/');
          if (data.extends !== rel) {
            data.extends = rel;
          }
        } catch {
          // base が存在しなければ何もしない
        }
      }
    }

    const after = JSON.stringify(data);
    if (before !== after) {
      console.log(`Update: ${path.relative(cwd, file)}`);
      if (!dryRun) {
        await fs.writeFile(file, stableStringify(data), 'utf8');
      }
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
