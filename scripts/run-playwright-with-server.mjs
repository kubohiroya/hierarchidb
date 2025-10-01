#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { URL } from 'node:url';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173';
const SERVER_WAIT_TIMEOUT_MS = Number(process.env.PLAYWRIGHT_SERVER_TIMEOUT_MS ?? 120_000);
const SERVER_POLL_INTERVAL_MS = 1_000;

function runCommand(command, args, { stdio = 'inherit' } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio, shell: false });
    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (signal) {
        const err = new Error(`Command ${command} ${args.join(' ')} terminated by signal ${signal}`);
        err.exitCode = null;
        err.signal = signal;
        reject(err);
        return;
      }
      if (code !== 0) {
        const err = new Error(`Command ${command} ${args.join(' ')} exited with code ${code}`);
        err.exitCode = code;
        reject(err);
        return;
      }
      resolve();
    });
  });
}

async function isServerAlive(url) {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    if (response.ok) return true;
  } catch (error) {
    if (error?.cause?.code !== 'ECONNREFUSED') {
      // Ignore other network errors and keep polling
    }
  }
  return false;
}

async function waitForServer(url, timeoutMs, intervalMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isServerAlive(url)) return;
    await sleep(intervalMs);
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for ${url}`);
}

async function startPreviewServer() {
  console.log('[playwright] No existing server detected, building preview bundle…');
  await runCommand('pnpm', ['--filter', '@hierarchidb/app', 'build']);

  console.log('[playwright] Starting preview server…');
  const serverProcess = spawn(
    'pnpm',
    ['--filter', '@hierarchidb/app', 'preview', '--', '--host', '127.0.0.1', '--port', new URL(BASE_URL).port || '4173'],
    { stdio: 'inherit', shell: false }
  );

  let finished = false;
  const onExit = (code, signal) => {
    if (!finished) {
      finished = true;
      console.error(`[playwright] Preview server exited unexpectedly (code=${code} signal=${signal ?? 'none'})`);
      process.exit(code ?? 1);
    }
  };
  serverProcess.on('exit', onExit);

  await waitForServer(BASE_URL, SERVER_WAIT_TIMEOUT_MS, SERVER_POLL_INTERVAL_MS);
  console.log('[playwright] Preview server is up.');

  return {
    process: serverProcess,
    stop: () => {
      finished = true;
      serverProcess.off('exit', onExit);
      if (!serverProcess.killed) {
        serverProcess.kill('SIGTERM');
      }
    },
  };
}

async function main() {
  const args = process.argv.slice(2);
  const targetUrl = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;

  const serverIsRunning = await isServerAlive(targetUrl).catch(() => false);
  let managedServer = null;

  if (!serverIsRunning) {
    managedServer = await startPreviewServer();
  } else {
    console.log(`[playwright] Reusing existing server at ${targetUrl}`);
  }

  const cleanup = () => {
    if (managedServer) {
      managedServer.stop();
    }
  };

  process.on('SIGINT', () => {
    cleanup();
    process.exit(130);
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(143);
  });

  try {
    const playwrightArgs = ['exec', 'playwright', 'test', ...args];
    await runCommand('pnpm', playwrightArgs);
  } finally {
    cleanup();
  }
}

main().catch((error) => {
  console.error('[playwright] E2E execution failed:', error);
  process.exit(typeof error.exitCode === 'number' ? error.exitCode : 1);
});
