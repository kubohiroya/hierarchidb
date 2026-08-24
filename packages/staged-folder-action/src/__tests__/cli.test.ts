import { describe, expect, it } from 'vitest';
import { runStagedFolderActionCli, type StagedFolderActionCliIo } from '../runStagedFolderActionCli.js';

const jsonManifest = JSON.stringify({
  version: 1,
  staging: {
    mode: 'temporary-copy',
    cleanup: 'retain',
  },
  overlay: {
    nodes: [],
  },
  actions: [],
});

const yamlManifest = `
version: 1
staging:
  mode: temporary-copy
  cleanup: retain
overlay:
  nodes: []
actions:
  - type: build
    mode: session-manager
  - type: map-image-capture
    mode: map-ui
    output:
      path: out.png
      width: 800
      height: 600
    viewport:
      bbox: [139, 35, 140, 36]
    layers:
      - path: "."
        visible: true
`;

describe('runStagedFolderActionCli', () => {
  it('validates JSON manifests in dry-run mode and writes a JSON result', async () => {
    const io = createIo({ 'config.json': jsonManifest });

    const exitCode = await runStagedFolderActionCli(
      ['--dry-run', '--json', '--config', 'config.json', '--source-node-id', 'source'],
      io
    );
    const result = JSON.parse(io.stdout.join('')) as {
      ok: boolean;
      dryRun: boolean;
      stagingMode: string;
      profileName: string;
      actions: string[];
    };

    expect(exitCode).toBe(0);
    expect(result).toMatchObject({
      ok: true,
      dryRun: true,
      stagingMode: 'temporary-copy',
      profileName: 'default',
      actions: [],
    });
  });

  it('validates YAML manifests with map image capture browser mode', async () => {
    const io = createIo({ 'config.yaml': yamlManifest });

    const exitCode = await runStagedFolderActionCli(
      [
        '--dry-run',
        '--json',
        '--config',
        'config.yaml',
        '--source-node-id',
        'source',
        '--browser',
        'headless',
        '--profile',
        'debug',
      ],
      io
    );
    const result = JSON.parse(io.stdout.join('')) as {
      ok: boolean;
      browserMode: string;
      profileName: string;
      actions: string[];
    };

    expect(exitCode).toBe(0);
    expect(result).toMatchObject({
      ok: true,
      browserMode: 'headless',
      profileName: 'debug',
      actions: ['build', 'map-image-capture'],
    });
  });

  it('fails when required CLI arguments are missing', async () => {
    const io = createIo({});

    const exitCode = await runStagedFolderActionCli(['--dry-run', '--json'], io);
    const result = JSON.parse(io.stdout.join('')) as {
      ok: boolean;
      error: { category: string; code: string };
    };

    expect(exitCode).toBe(1);
    expect(result).toMatchObject({
      ok: false,
      error: {
        category: 'cli',
        code: 'STAGED_FOLDER_ACTION_CLI_MISSING_ARGUMENT',
      },
    });
  });

  it('fails explicitly when execution is requested before host integration exists', async () => {
    const io = createIo({ 'config.json': jsonManifest });

    const exitCode = await runStagedFolderActionCli(
      ['--json', '--config', 'config.json', '--source-node-id', 'source'],
      io
    );
    const result = JSON.parse(io.stdout.join('')) as {
      ok: boolean;
      error: { category: string; code: string };
    };

    expect(exitCode).toBe(1);
    expect(result).toMatchObject({
      ok: false,
      error: {
        category: 'cli',
        code: 'STAGED_FOLDER_ACTION_CLI_EXECUTION_HOST_NOT_CONFIGURED',
      },
    });
  });
});

function createIo(files: Record<string, string>): StagedFolderActionCliIo & {
  stdout: string[];
  stderr: string[];
} {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    readTextFile: async (filePath) => {
      const content = files[filePath];
      if (content === undefined) {
        throw new Error(`file not found: ${filePath}`);
      }
      return content;
    },
    writeStdout: (text) => {
      stdout.push(text);
    },
    writeStderr: (text) => {
      stderr.push(text);
    },
  };
}
