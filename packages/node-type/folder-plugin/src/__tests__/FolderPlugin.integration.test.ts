import { describe, expect, it } from 'vitest';
import { FolderDefinition } from '../definitions/FolderDefinition';

describe('Folder Plugin (policy/UI only)', () => {
  it('exposes folder node type with CoreDB-backed metadata', () => {
    expect(FolderDefinition.nodeType).toBe('folder');
    expect(FolderDefinition.database.dbName).toBe('CoreDB');
    expect(FolderDefinition.database.entityStore).toBe('folders');
    expect(FolderDefinition.database.version).toBe(1);
    expect((FolderDefinition as any).entityHandler).toBeUndefined();
    expect((FolderDefinition as any).lifecycle).toBeUndefined();
  });
});
