import { describe, expect, it } from 'vitest';
import {
  getNodeCreateTemplateMenuEntries,
  parseNodeCreateAction,
  resolveNodeTemplateExecution,
} from '../nodeCreateTemplates.ts';

describe('nodeCreateTemplates', () => {
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
    expect(resourcesEntries.map((entry) => entry.createType)).toContain(
      'folder::template:population-2023'
    );
    expect(projectsEntries).toHaveLength(0);
  });
});
