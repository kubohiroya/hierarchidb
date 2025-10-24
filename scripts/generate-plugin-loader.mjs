import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const pnpmArgs = ['--filter', '@hierarchidb/tools', 'run', 'gen-plugin-loaders'];

export async function generatePluginRegistry() {
  await new Promise((resolve, reject) => {
    const child = spawn('pnpm', pnpmArgs, {
      cwd: repoRoot,
      stdio: 'inherit',
      env: process.env,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve(undefined);
      } else {
        reject(new Error(`gen-plugin-loaders exited with code ${code ?? 'unknown'}`));
      }
    });
  });
}

const invokedDirectly = (() => {
  if (!process.argv[1]) return false;
  try {
    return pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  generatePluginRegistry().catch((error) => {
    console.error('[generate-plugin-loader] Failed to generate plugin registry', error);
    process.exitCode = 1;
  });
}
