#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const pkgDir = path.resolve(process.cwd());
const distDir = path.join(pkgDir, 'dist');
const srcAmbient = path.join(pkgDir, 'src', 'ambient-ui.d.ts');
const distAmbient = path.join(distDir, 'ambient-ui.d.ts');
const distIndexDts = path.join(distDir, 'index.d.ts');

try {
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });
  if (fs.existsSync(srcAmbient)) {
    fs.copyFileSync(srcAmbient, distAmbient);
  }
  if (fs.existsSync(distIndexDts)) {
    let content = fs.readFileSync(distIndexDts, 'utf-8');
    const ref = '/// <reference path="./ambient-ui.d.ts" />';
    if (!content.includes('ambient-ui.d.ts')) {
      content = ref + '\n' + content;
      fs.writeFileSync(distIndexDts, content);
    }
  }
  console.log('[common-type] ambient types emitted to dist and referenced by index.d.ts');
} catch (e) {
  console.warn('[common-type] emit ambient failed:', e?.message || e);
}

