/**
 * @file PluginFlows.integration.test.ts
 * @description Headless integration tests per plugin, simulating dialog flows via WorkerAPI mock
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import type { NodeId } from '@hierarchidb/common-types';
import { WorkerAPIMock } from '../__tests__/plugin-dialog-mocks';

type DialogAPI = ReturnType<WorkerAPIMock['getMultiStepDialogAPI']>;

let workerAPI: WorkerAPIMock | undefined;
let dialogAPI: DialogAPI;

beforeEach(async () => {
  workerAPI = new WorkerAPIMock('test-services');
  await workerAPI.initialize();
  dialogAPI = workerAPI.getMultiStepDialogAPI();
});

afterEach(async () => {
  await workerAPI?.shutdown?.();
});

async function driveToSavable(
  draftId: NodeId,
  steps: number,
  updater: (step: number) => Promise<void>
) {
  for (let s = 0; s < steps; s++) {
    const caps = await dialogAPI.evaluateCapabilities(draftId, s);
    if (!caps.canProceedToNext && !caps.canSave) {
      await updater(s);
    }
  }
  const finalCaps = await dialogAPI.evaluateCapabilities(draftId, steps - 1);
  expect(finalCaps.canSave).toBe(true);
}

describe('Basemap plugin flow', () => {
  it('opens, fills steps, and becomes savable', async () => {
    const id = await dialogAPI.createDraft('basemap');
    await driveToSavable(id, 4, async (step) => {
      if (step === 0) {
        await dialogAPI.updateDraft(id, { data: { name: 'BaseMap A' } });
      } else if (step === 1) {
        await dialogAPI.updateDraft(id, { data: { mapStyle: { style: 'streets' } } });
      } else if (step === 2) {
        await dialogAPI.updateDraft(id, {
          data: { viewport: { center: [139.6917, 35.6895], zoom: 10 } },
        });
      }
    });
  });
});

describe('Spreadsheet plugin flow', () => {
  it('opens, sets data source, savable', async () => {
    const id = await dialogAPI.createDraft('spreadsheet');
    await driveToSavable(id, 3, async (step) => {
      if (step === 0) {
        await dialogAPI.updateDraft(id, { data: { name: 'Sheet 1' } });
      } else if (step === 1) {
        await dialogAPI.updateDraft(id, { data: { dataSource: { type: 'manual' } } });
      }
    });
  });
});

describe('Shape plugin flow', () => {
  it('fills required steps (source/license/levels/countries) and becomes savable', async () => {
    const id = await dialogAPI.createDraft('shape');
    await driveToSavable(id, 5, async (step) => {
      if (step === 0) await dialogAPI.updateDraft(id, { data: { name: 'Shapes' } });
      if (step === 1)
        await dialogAPI.updateDraft(id, { data: { dataSourceName: 'geofabrik' } });
      if (step === 2) await dialogAPI.updateDraft(id, { data: { licenseAgreement: true } });
      if (step === 3)
        await dialogAPI.updateDraft(id, { data: { selectedAdminLevels: [0, 1] } });
      if (step === 4)
        await dialogAPI.updateDraft(id, { data: { selectedCountries: ['JPN'] } });
    });
  });
});

describe('Styler plugin flow', () => {
  it('keeps optional style empty or valid, then categories valid', async () => {
    const id = await dialogAPI.createDraft('styler');
    await driveToSavable(id, 3, async (step) => {
      if (step === 0) await dialogAPI.updateDraft(id, { data: { name: 'Styler' } });
      if (step === 1)
        await dialogAPI.updateDraft(id, {
          data: {
            /* styleType omitted => optional ok */
          },
        });
      if (step === 2)
        await dialogAPI.updateDraft(id, { data: { categories: ['A', 'B', 'C'] } });
    });
  });
});

describe('Route plugin flow', () => {
  it('basic info valid -> subsequent steps savable', async () => {
    const id = await dialogAPI.createDraft('route');
    await driveToSavable(id, 3, async (step) => {
      if (step === 0)
        await dialogAPI.updateDraft(id, {
          data: { name: 'Route1', routeType: 'car', transportModes: ['car'] },
        });
    });
  });
});

describe('Resolver plugin flow', () => {
  it('fills schemas/mapping and is savable', async () => {
    const id = await dialogAPI.createDraft('resolver');
    await driveToSavable(id, 6, async (step) => {
      if (step === 0) await dialogAPI.updateDraft(id, { data: { name: 'Resolver1' } });
      if (step === 1)
        await dialogAPI.updateDraft(id, { data: { sourceSchema: 'S', targetSchema: 'T' } });
      if (step === 2) await dialogAPI.updateDraft(id, { data: { mappingRules: [] } });
    });
  });
});

describe('Project plugin flow', () => {
  it('all steps considered enabled/savable in mock', async () => {
    const id = await dialogAPI.createDraft('project');
    await driveToSavable(id, 6, async () => {});
  });
});
