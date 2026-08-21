import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const initializeBrowserGlobals = vi.hoisted(() => vi.fn());

vi.mock('../../contexts/AppProviders.js', () => ({
  AppProviders: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('../../router/init/initializeBrowserGlobals.ts', () => ({
  initializeBrowserGlobals,
}));

describe('root import boundary', () => {
  beforeEach(() => {
    vi.resetModules();
    initializeBrowserGlobals.mockClear();
  });

  it('does not initialize browser globals as an import side effect', async () => {
    await import('../../root.js');

    expect(initializeBrowserGlobals).not.toHaveBeenCalled();
  });
});
