#!/usr/bin/env node
import { spawn } from 'node:child_process';

const processes = [];
let exiting = false;

const COLORS = {
  turbo: '\u001b[35m',
  dev: '\u001b[36m',
  reset: '\u001b[0m',
};

function formatLines(buffer, label, color) {
  return buffer
    .toString()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => `${color}[${label}]${COLORS.reset} ${line}`)
    .join('\n');
}

function wireOutput(child, label, color) {
  child.stdout?.on('data', (data) => {
    const text = formatLines(data, label, color);
    if (text) {
      process.stdout.write(`${text}\n`);
    }
  });
  child.stderr?.on('data', (data) => {
    const text = formatLines(data, label, color);
    if (text) {
      process.stderr.write(`${text}\n`);
    }
  });
}

function spawnWithLabel(label, color, command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: ['inherit', 'pipe', 'pipe'],
    env: process.env,
    ...options,
  });
  processes.push({ label, child });
  wireOutput(child, label, color);

  child.on('close', (code, signal) => {
    if (!exiting) {
      const reason = signal ? `${signal}` : `exit code ${code}`;
      process.stderr.write(`${color}[${label}]${COLORS.reset} stopped (${reason}).\n`);
      initiateShutdown(code ?? 1);
    }
  });

  child.on('error', (error) => {
    process.stderr.write(`${color}[${label}]${COLORS.reset} failed to start: ${error.message}\n`);
    initiateShutdown(1);
  });
}

function initiateShutdown(exitCode = 0) {
  if (exiting) return;
  exiting = true;

  for (const { child } of processes) {
    if (!child.killed) {
      child.kill('SIGINT');
    }
  }

  const timeout = setTimeout(() => {
    for (const { child } of processes) {
      if (!child.killed) {
        child.kill('SIGTERM');
      }
    }
  }, 5000);

  Promise.all(
    processes.map(({ child }) =>
      new Promise((resolve) => {
        child.on('close', () => resolve());
      }),
    ),
  ).finally(() => {
    clearTimeout(timeout);
    process.exit(exitCode);
  });
}

process.on('SIGINT', () => initiateShutdown(0));
process.on('SIGTERM', () => initiateShutdown(0));

spawnWithLabel('turbo', COLORS.turbo, 'pnpm', ['run', 'turbo:watch:internal']);
spawnWithLabel('dev', COLORS.dev, 'bash', ['./scripts/start-env.sh', 'development']);

process.on('exit', () => {
  for (const { child } of processes) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }
});
