import { describe, expect, it, vi } from 'vitest';
import {
  initializeYamlStorageProductionPreflight,
  parseYamlStorageProductionPreflightMode,
} from '../initializeYamlStorageProductionPreflight.js';

const RELEASE_VERSION = 'a'.repeat(40);

function installMarkup(): void {
  document.body.innerHTML = `
    <span id="preflight-mode"></span>
    <span id="preflight-release"></span>
    <span id="preflight-state"></span>
    <button id="run-preflight" type="button"></button>
    <pre id="preflight-output"></pre>
  `;
}

describe('initializeYamlStorageProductionPreflight', () => {
  it('does not execute automatically and executes at most once after a click', async () => {
    installMarkup();
    const execute = vi.fn(async () => ({
      mode: 'pre' as const,
      status: 'rejected' as const,
      code: 'YAML_DATABASE_NOT_FOUND' as const,
      timestamp: '2026-08-21T00:00:00.000Z',
      releaseVersion: RELEASE_VERSION,
    }));

    initializeYamlStorageProductionPreflight({
      document,
      mode: 'pre',
      releaseVersion: RELEASE_VERSION,
      execute,
    });

    expect(execute).not.toHaveBeenCalled();
    const button = document.getElementById('run-preflight');
    if (!(button instanceof HTMLButtonElement)) throw new Error('button-missing');
    button.click();
    button.click();
    await vi.waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    await vi.waitFor(() =>
      expect(document.getElementById('preflight-state')?.textContent).toBe('rejected')
    );
    expect(button.disabled).toBe(true);
    expect(document.getElementById('preflight-output')?.textContent).toContain(
      'YAML_DATABASE_NOT_FOUND'
    );
  });

  it.each([
    ['https://example.test/preflight?mode=pre', 'pre'],
    ['https://example.test/preflight?mode=post', 'post'],
    ['https://example.test/preflight?mode=recovery-pre', 'recovery-pre'],
    ['https://example.test/preflight?mode=recovery-post', 'recovery-post'],
    ['https://example.test/preflight?mode=recovery-interrupted-core', 'recovery-interrupted-core'],
    [
      'https://example.test/preflight?mode=recovery-interrupted-core-v1',
      'recovery-interrupted-core-v1',
    ],
    ['https://example.test/preflight', null],
    ['https://example.test/preflight?mode=pre&mode=post', null],
    ['https://example.test/preflight?mode=unknown', null],
  ] as const)('parses an exact single mode from %s', (url, expected) => {
    expect(parseYamlStorageProductionPreflightMode(new URL(url))).toBe(expected);
  });
});
