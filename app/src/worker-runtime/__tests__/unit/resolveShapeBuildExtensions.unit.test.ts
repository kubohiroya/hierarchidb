import { describe, expect, it, vi } from 'vitest';
import { resolveShapeBuildExtensions } from '../../resolveShapeBuildExtensions.js';

const createExtensions = () => ({
  setCorsProxyBaseURL: vi.fn(),
  setUiStorageBridge: vi.fn(),
  generateDownloadTaskPayloadsFromSelection: vi.fn(),
});

describe('resolveShapeBuildExtensions', () => {
  it('accepts the exact Shape worker extension contract', () => {
    const shapeBuildExtensions = createExtensions();
    expect(resolveShapeBuildExtensions({ shapeBuildExtensions })).toBe(shapeBuildExtensions);
  });

  it('rejects a missing Shape proxy configuration method', () => {
    expect(() =>
      resolveShapeBuildExtensions({
        shapeBuildExtensions: {
          setUiStorageBridge: vi.fn(),
          generateDownloadTaskPayloadsFromSelection: vi.fn(),
        },
      })
    ).toThrow('shapeBuildExtensions.setCorsProxyBaseURL must be a function');
  });

  it('rejects a missing Shape storage bridge method', () => {
    expect(() =>
      resolveShapeBuildExtensions({
        shapeBuildExtensions: {
          setCorsProxyBaseURL: vi.fn(),
          generateDownloadTaskPayloadsFromSelection: vi.fn(),
        },
      })
    ).toThrow('shapeBuildExtensions.setUiStorageBridge must be a function');
  });

  it('rejects a missing Shape payload generation method', () => {
    expect(() =>
      resolveShapeBuildExtensions({
        shapeBuildExtensions: {
          setCorsProxyBaseURL: vi.fn(),
          setUiStorageBridge: vi.fn(),
        },
      })
    ).toThrow('shapeBuildExtensions.generateDownloadTaskPayloadsFromSelection must be a function');
  });

  it('rejects a missing Shape auth storage bridge method', () => {
    expect(() =>
      resolveShapeBuildExtensions({
        shapeBuildExtensions: {
          setCorsProxyBaseURL: vi.fn(),
          generateDownloadTaskPayloadsFromSelection: vi.fn(),
        },
      })
    ).toThrow('shapeBuildExtensions.setUiStorageBridge must be a function');
  });
});
