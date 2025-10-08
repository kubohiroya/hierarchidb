import { rmSync } from 'node:fs';
import { join } from 'node:path';

const cwd = process.cwd();
const distDir = join(cwd, 'dist');

rmSync(distDir, { recursive: true, force: true });
