#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const pkgDir = path.resolve(process.cwd());
const distDir = path.join(pkgDir, 'dist');
const srcAmbient = path.join(pkgDir, 'src', 'ambient-ui.d.ts');
const srcTypeRoot = path.join(pkgDir, 'src', '@types');
const distAmbient = path.join(distDir, 'ambient-ui.d.ts');
const distTypeRoot = path.join(distDir, '@types');
const distIndexDts = path.join(distDir, 'index.d.ts');

const ensureDir = dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const copyDir = (src, dest) => {
  ensureDir(dest);
  for (const entry of fs.readdirSync(src)) {
    const srcEntry = path.join(src, entry);
    const destEntry = path.join(dest, entry);
    const stat = fs.statSync(srcEntry);
    if (stat.isDirectory()) {
      copyDir(srcEntry, destEntry);
    } else if (stat.isFile()) {
      fs.copyFileSync(srcEntry, destEntry);
    }
  }
};

try {
  ensureDir(distDir);
  if (fs.existsSync(srcAmbient)) {
    fs.copyFileSync(srcAmbient, distAmbient);
  }
  if (fs.existsSync(srcTypeRoot)) {
    copyDir(srcTypeRoot, distTypeRoot);
  }
  if (fs.existsSync(distIndexDts)) {
    let content = fs.readFileSync(distIndexDts, 'utf-8');
    const directives = new Set();
    const addDirective = relPath => {
      const directive = `/// <reference path="${relPath}" />`;
      if (!content.includes(relPath) && !directives.has(directive)) {
        directives.add(directive);
      }
    };
    if (fs.existsSync(distAmbient)) {
      addDirective('./ambient-ui.d.ts');
    }
    if (fs.existsSync(distTypeRoot)) {
      const stack = [distTypeRoot];
      while (stack.length) {
        const dir = stack.pop();
        for (const entry of fs.readdirSync(dir)) {
          const abs = path.join(dir, entry);
          const stat = fs.statSync(abs);
          if (stat.isDirectory()) {
            stack.push(abs);
          } else if (stat.isFile() && abs.endsWith('.d.ts')) {
            const rel = './' + path.relative(distDir, abs).replace(/\\/g, '/');
            addDirective(rel);
          }
        }
      }
    }
    if (directives.size > 0) {
      content = Array.from(directives).join('\n') + '\n' + content;
      fs.writeFileSync(distIndexDts, content);
    }
  }
  console.log('[common-type] ambient types emitted to dist and referenced by index.d.ts');
} catch (e) {
  console.warn('[common-type] emit ambient failed:', e?.message || e);
}
