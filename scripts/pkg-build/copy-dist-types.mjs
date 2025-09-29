import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const cwd = process.cwd();
const distTypesDir = join(cwd, 'dist-types');

if (!existsSync(distTypesDir)) {
  console.warn('[copy-dist-types] dist-types directory not found, skipping.');
  process.exit(0);
}

const distDir = join(cwd, 'dist');

mkdirSync(distDir, { recursive: true });
cpSync(distTypesDir, distDir, { recursive: true });
rmSync(distTypesDir, { recursive: true, force: true });

const buildInfoPath = join(distDir, '.tsbuildinfo');
if (existsSync(buildInfoPath)) {
  rmSync(buildInfoPath, { force: true });
}
