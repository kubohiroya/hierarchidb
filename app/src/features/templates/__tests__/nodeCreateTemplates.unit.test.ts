import type { TreeId, NodeId } from '@hierarchidb/core-types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  importNodeTemplateById,
  getNodeCreateTemplateMenuEntries,
  parseNodeCreateAction,
  resolveNodeTemplateExecution,
} from '../nodeCreateTemplates.ts';

describe('nodeCreateTemplates', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.fetch = originalFetch;
  });

  const buildRequiredShapeTemplateData = {
    nodes: [
      {
        nodeType: 'shape',
        metadata: {
          name: 'Shape A',
          description: 'Imported shape',
        },
        draftMetadata: undefined,
        draftData: {
          buildConfig: { source: 'template' },
        },
      },
    ],
  };

  const buildRequiredStylerTemplateData = {
    nodes: [
      {
        nodeType: 'styler',
        metadata: {
          name: 'Styler A',
          description: 'Imported styler',
        },
        draftMetadata: undefined,
        draftData: {
          source: 'template',
        },
      },
    ],
  };

  const makeFetchMock = (templateData: unknown) => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: () => 'application/json',
      },
      json: async () => templateData,
    });

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);
    return fetchMock;
  };

  it('parses shape preset create action', () => {
    const parsed = parseNodeCreateAction('create:shape::preset:world-level0');
    expect(parsed).toEqual({
      nodeType: 'shape',
      shapePresetId: 'world-level0',
    });
  });

  it('parses folder template create action', () => {
    const parsed = parseNodeCreateAction('create:folder::template:population-2023');
    expect(parsed).toEqual({
      nodeType: 'folder',
      templateId: 'population-2023',
    });
  });

  it('parses default folder submenu action as plain folder create', () => {
    const parsed = parseNodeCreateAction('create:folder::template:default');
    expect(parsed).toEqual({
      nodeType: 'folder',
    });
  });

  it('resolves folder template execution', () => {
    const execution = resolveNodeTemplateExecution('folder', 'population-2023');
    expect(execution).toEqual({
      kind: 'importTemplate',
      templateId: 'population-2023',
    });
  });

  it('returns folder template menu entries only for resources', () => {
    const resourcesEntries = getNodeCreateTemplateMenuEntries('folder', 'resources');
    const projectsEntries = getNodeCreateTemplateMenuEntries('folder', 'projects');
    expect(resourcesEntries[0]?.createType).toBe('folder::template:default');
    expect(projectsEntries[0]?.createType).toBe('folder::template:default');
    expect(resourcesEntries.map((entry) => entry.createType)).toContain(
      'folder::template:population-2023'
    );
    expect(projectsEntries).toHaveLength(1);
  });

  it('adds buildRequired=true to shape nodes imported from templates when omitted', async () => {
    const importNodes = vi.fn(async () => undefined);
    const getImportExportAPI = vi.fn(async () => ({
      importNodes,
      detectFileFormat: vi.fn(() => 'json'),
      importFile: vi.fn(),
      exportNodes: vi.fn(async () => new Blob()),
    }));
    const client = {
      getImportExportAPI,
    } as {
      getImportExportAPI: () => Promise<{
        importNodes: ReturnType<typeof vi.fn>;
        detectFileFormat: () => string;
        importFile: () => Promise<void>;
        exportNodes: () => Promise<Blob>;
      }>;
    };

    const fetchMock = makeFetchMock(buildRequiredShapeTemplateData);

    await importNodeTemplateById({
      client,
      treeId: 'r:tree' as TreeId,
      targetParentId: 'r:parent' as NodeId,
      templateId: 'population-2023',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(importNodes).toHaveBeenCalledTimes(1);
    const payload = importNodes.mock.calls[0]?.[0];
    expect(payload?.data?.nodes?.[0]).toMatchObject({
      metadata: {
        buildMetadata: {
          buildRequired: true,
        },
      },
      draftMetadata: {
        buildMetadata: {
          buildRequired: true,
        },
      },
    });
  });

  it('preserves explicit buildMetadata when template node defines it', async () => {
    const templateData = {
      nodes: [
        {
          nodeType: 'styler',
          metadata: {
            name: 'Styler A',
            description: 'Imported styler',
            buildMetadata: {
              buildRequired: false,
            },
          },
          draftMetadata: {
            buildMetadata: {
              buildRequired: false,
            },
          },
        },
      ],
    };
    const importNodes = vi.fn(async () => undefined);
    const getImportExportAPI = vi.fn(async () => ({
      importNodes,
      detectFileFormat: vi.fn(() => 'json'),
      importFile: vi.fn(),
      exportNodes: vi.fn(async () => new Blob()),
    }));
    const client = {
      getImportExportAPI,
    } as {
      getImportExportAPI: () => Promise<{
        importNodes: ReturnType<typeof vi.fn>;
        detectFileFormat: () => string;
        importFile: () => Promise<void>;
        exportNodes: () => Promise<Blob>;
      }>;
    };

    const fetchMock = makeFetchMock({
      nodes: [
        {
          nodeType: 'styler',
          metadata: {
            name: 'Styler A',
            description: 'Imported styler',
            buildMetadata: {
              buildRequired: false,
            },
          },
          draftMetadata: {
            buildMetadata: {
              buildRequired: false,
            },
          },
        },
      ],
    });

    await importNodeTemplateById({
      client,
      treeId: 'r:tree' as TreeId,
      targetParentId: 'r:parent' as NodeId,
      templateId: 'population-2023',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(importNodes).toHaveBeenCalledTimes(1);
    const payload = importNodes.mock.calls[0]?.[0];
    expect(payload?.data?.nodes?.[0]).toMatchObject({
      metadata: {
        buildMetadata: {
          buildRequired: false,
        },
      },
      draftMetadata: {
        buildMetadata: {
          buildRequired: false,
        },
      },
    });
  });

  it('adds buildRequired=true to styler nodes imported from templates when omitted', async () => {
    const importNodes = vi.fn(async () => undefined);
    const getImportExportAPI = vi.fn(async () => ({
      importNodes,
      detectFileFormat: vi.fn(() => 'json'),
      importFile: vi.fn(),
      exportNodes: vi.fn(async () => new Blob()),
    }));
    const client = {
      getImportExportAPI,
    } as {
      getImportExportAPI: () => Promise<{
        importNodes: ReturnType<typeof vi.fn>;
        detectFileFormat: () => string;
        importFile: () => Promise<void>;
        exportNodes: () => Promise<Blob>;
      }>;
    };

    const fetchMock = makeFetchMock(buildRequiredStylerTemplateData);

    await importNodeTemplateById({
      client,
      treeId: 'r:tree' as TreeId,
      targetParentId: 'r:parent' as NodeId,
      templateId: 'population-2023',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(importNodes).toHaveBeenCalledTimes(1);
    const payload = importNodes.mock.calls[0]?.[0];
    expect(payload?.data?.nodes?.[0]).toMatchObject({
      metadata: {
        buildMetadata: {
          buildRequired: true,
        },
      },
      draftMetadata: {
        buildMetadata: {
          buildRequired: true,
        },
      },
    });
  });
});
