import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('YamlDB quiescence gate', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('closes an existing singleton and permanently rejects reopening', async () => {
    const yamlDbModule = await import('../src/YamlDB.js');
    const database = yamlDbModule.getYamlDB();
    const close = vi.spyOn(database, 'close');

    yamlDbModule.revokeLegacyYamlAccessAndClose();

    expect(close).toHaveBeenCalledOnce();
    expect(() => yamlDbModule.getYamlDB()).toThrow('legacy-yaml-access-revoked');
  });

  it('does not instantiate YamlDB merely to prove that no handle exists', async () => {
    const yamlDbModule = await import('../src/YamlDB.js');
    const close = vi.spyOn(yamlDbModule.YamlDB.prototype, 'close');

    yamlDbModule.revokeLegacyYamlAccessAndClose();

    expect(close).not.toHaveBeenCalled();
    expect(() => yamlDbModule.getYamlDB()).toThrow('legacy-yaml-access-revoked');
  });
});
