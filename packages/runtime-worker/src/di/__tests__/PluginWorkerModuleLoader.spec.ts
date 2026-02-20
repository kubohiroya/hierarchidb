import { describe, expect, it, vi } from 'vitest';
import { PluginWorkerModuleLoader } from '../PluginWorkerModuleLoader';

class TestableLoader extends PluginWorkerModuleLoader {
  public lastSpecifier: string | undefined;

  protected override loadFromSpecifier<T>(specifier: string): Promise<T> {
    this.lastSpecifier = specifier;
    if (specifier === 'fail') {
      return Promise.reject(new Error('boom'));
    }
    return Promise.resolve({} as T);
  }
}

describe('PluginWorkerModuleLoader', () => {
  it('loads using specifier map when provided', async () => {
    const loader = new TestableLoader(
      { timeline: '@hierarchidb/timeline-plugin/worker' },
      undefined,
      undefined
    );
    await loader.importModule('timeline');
    expect(loader.lastSpecifier).toBe('@hierarchidb/timeline-plugin/worker');
  });

  it('falls back to default specifier when map is missing', async () => {
    const loader = new TestableLoader({}, undefined, undefined);
    await loader.importModule('styler');
    expect(loader.lastSpecifier).toBe('@hierarchidb/styler-plugin/worker');
  });

  it('retries with specifier when direct loader throws', async () => {
    const failingLoader = vi.fn().mockRejectedValue(new Error('fail'));
    const loader = new TestableLoader(
      { timeline: '@hierarchidb/timeline-plugin/worker' },
      { timeline: failingLoader },
      undefined
    );
    await loader.importModule('timeline');
    expect(failingLoader).toHaveBeenCalledTimes(1);
    expect(loader.lastSpecifier).toBe('@hierarchidb/timeline-plugin/worker');
  });
});
