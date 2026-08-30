import { describe, expect, it } from 'vitest';
import {
  IDEGSM_PROJECT_PLUGIN_FEATURE_FLAG_DEFAULT,
  IDEGSM_PROJECT_PLUGIN_NODE_TYPE,
  IdeGsmProjectPluginManifest,
} from '../index.js';

describe('IDE-GSM project plugin manifest', () => {
  it('declares the first-class node behind an off-by-default flag', () => {
    expect(IDEGSM_PROJECT_PLUGIN_FEATURE_FLAG_DEFAULT).toBe(false);
    expect(IdeGsmProjectPluginManifest.nodeType).toBe(IDEGSM_PROJECT_PLUGIN_NODE_TYPE);
    expect(IdeGsmProjectPluginManifest.visibility).toEqual({
      showInCreateMenu: false,
      showInPluginList: false,
    });
    expect(IdeGsmProjectPluginManifest.category).toEqual({
      id: 'ide-gsm',
      menuGroup: 'ide-gsm',
      createOrder: 520,
    });
  });

  it('exposes only version 1 root identity fields in the schema', () => {
    const fieldNames = IdeGsmProjectPluginManifest.schema?.fields?.map((field) => field.name);

    expect(fieldNames).toEqual([
      'version',
      'connectionName',
      'projectRelativePath',
      'activeSyncGenerationId',
      'syncState',
      'syncedAt',
    ]);
    expect(fieldNames).not.toContain('mountKind');
    expect(fieldNames).not.toContain('mountId');
    expect(fieldNames).not.toContain('sourceKind');
    expect(fieldNames).not.toContain('projectId');
  });
});
