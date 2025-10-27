import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const commands = [
  ['--filter', '@hierarchidb/tools-plugin-manifest-loader', 'run', 'build'],
  ['--filter', '@hierarchidb/tools-build-scripts', 'run', 'gen-plugin-loaders'],
];

export async function generatePluginRegistry() {
  for (const args of commands) {
    await new Promise((resolve, reject) => {
      const child = spawn('pnpm', args, {
        cwd: repoRoot,
        stdio: 'inherit',
        env: process.env,
      });

      child.on('error', reject);
      child.on('exit', (code) => {
        if (code === 0) {
          resolve(undefined);
        } else {
          reject(new Error(`pnpm ${args.join(' ')} exited with code ${code ?? 'unknown'}`));
        }
      });
    });
  }
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
