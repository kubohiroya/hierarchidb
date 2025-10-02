import { describe, expect, it, vi } from 'vitest';
import path from 'node:path';

// NOTE:
// This test assumes that @react-router/dev has been built (pnpm --filter @react-router/dev build)
// and that the patch introducing the Worker guard is already applied. It exercises the exported
// Vite plugin directly to verify the generated virtual modules.

type VitePlugin = {
  name: string;
  load?: (id: string) => Promise<string | null> | string | null;
};

const reactRouterVitePlugin = (): VitePlugin[] => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pluginFactory = require(path.resolve(
    __dirname,
    '../app/node_modules/@react-router/dev/dist/vite.js',
  ));
  return pluginFactory.reactRouter({
    dirname: process.cwd(),
    reactRouterConfig: {
      future: {},
      routes: [],
    },
  }) as VitePlugin[];
};

const loadVirtualModule = async (plugins: VitePlugin[], name: string) => {
  const target = plugins.find((plugin) => plugin.name === name);
  if (!target?.load) {
    throw new Error(`Plugin ${name} has no load hook`);
  }
  return target.load((target as any).resolvedId ?? '\0');
};

describe('react-router vite worker HMR runtime', () => {
  const plugins = reactRouterVitePlugin();

  it('omits fast-refresh bootstrap inside a worker', async () => {
    const code = await loadVirtualModule(plugins, 'react-router:inject-hmr-runtime');
    expect(code).toBeTruthy();
    expect(code).toContain("const inWebWorker = typeof WorkerGlobalScope !== 'undefined'");
    expect(code).toContain('if (!inWebWorker) {');

    const RefreshRuntime = {
      injectIntoGlobalHook: vi.fn(),
      createSignatureFunctionForTransform: vi.fn(),
    };
    const WorkerGlobalScope = function WorkerGlobalScope(this: unknown) {
      Object.assign(this, {});
    } as unknown as { new (): unknown };
    const self = new WorkerGlobalScope();

    const execute = new Function('RefreshRuntime', 'WorkerGlobalScope', 'self', code as string);
    execute(RefreshRuntime, WorkerGlobalScope, self);

    expect(RefreshRuntime.injectIntoGlobalHook).not.toHaveBeenCalled();
  });

  it('keeps fast-refresh bootstrap on the main thread', async () => {
    const code = await loadVirtualModule(plugins, 'react-router:inject-hmr-runtime');
    const RefreshRuntime = {
      injectIntoGlobalHook: vi.fn(),
      createSignatureFunctionForTransform: vi.fn(),
    };
    const window: Record<string, unknown> = {};
    const execute = new Function('RefreshRuntime', 'window', code as string);
    execute(RefreshRuntime, window);

    expect(RefreshRuntime.injectIntoGlobalHook).toHaveBeenCalledWith(window);
    expect(typeof window.$RefreshReg$).toBe('function');
    expect(typeof window.$RefreshSig$).toBe('function');
  });

  it('does not embed refresh runtime sources inside the worker bundle', async () => {
    const code = await loadVirtualModule(plugins, 'react-router:hmr-runtime');
    expect(code).toContain("const inWebWorker = typeof WorkerGlobalScope !== 'undefined'");
    expect(code).toContain('if (!inWebWorker) {');

    const WorkerGlobalScope = function WorkerGlobalScope(this: unknown) {
      Object.assign(this, {});
    } as unknown as { new (): unknown };
    const self = new WorkerGlobalScope();

    const execute = new Function('WorkerGlobalScope', 'self', code as string);
    execute(WorkerGlobalScope, self);

    expect(code).not.toMatch(/register\(.+\)/);
  });
});
