import { copyFileSync, existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';

const distDir = path.resolve(process.cwd(), 'dist');
const index2Path = path.join(distDir, 'index2.d.ts');
const index2MapPath = path.join(distDir, 'index2.d.ts.map');
const indexPath = path.join(distDir, 'index.d.ts');
const indexMapPath = path.join(distDir, 'index.d.ts.map');

if (!existsSync(index2Path)) {
  process.exit(0);
}

copyFileSync(index2Path, indexPath);
if (existsSync(index2MapPath)) {
  copyFileSync(index2MapPath, indexMapPath);
}

unlinkSync(index2Path);
if (existsSync(index2MapPath)) {
  unlinkSync(index2MapPath);
}
