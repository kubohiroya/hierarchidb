import { expect, test } from '@playwright/test';
import './utils/skip-if-disabled';

const workflowFixture = {
  timeoutMs: 20_000,
  browserScope: 'chromium',
  flakeControls: {
    retries: 0,
    network: 'none',
    clock: 'not-used',
  },
  rows: {
    preview: { id: 'preview-1', name: 'Alpha', derivedLabel: 'Display only' },
    map: { id: 'map-1', name: 'Harbor', derivedLabel: 'Distance 12km' },
    popover: { id: 'popover-1', name: 'Point A', derivedLabel: 'Centroid label' },
  },
} as const;

test.describe('feature table edit workflow contract fixture', () => {
  test.describe.configure({ mode: 'serial', timeout: workflowFixture.timeoutMs, retries: 0 });

  test.beforeEach(({ browserName }) => {
    test.skip(
      browserName !== workflowFixture.browserScope,
      'feature table edit workflow fixture is scoped to chromium for deterministic DOM editing'
    );
  });

  test('covers preview, map table, popover, and derived read-only edit behavior', async ({
    page,
  }) => {
    await page.setContent(`<!doctype html>
      <main>
        <section data-surface="preview">
          <input aria-label="Preview Name" value="${workflowFixture.rows.preview.name}" />
          <output aria-label="Preview Error"></output>
          <span data-derived="preview">${workflowFixture.rows.preview.derivedLabel}</span>
        </section>
        <section data-surface="map">
          <input aria-label="Map Name" value="${workflowFixture.rows.map.name}" />
          <output aria-label="Map Error"></output>
          <span data-derived="map">${workflowFixture.rows.map.derivedLabel}</span>
        </section>
        <section data-surface="popover">
          <input aria-label="Popover Name" value="${workflowFixture.rows.popover.name}" />
          <output aria-label="Popover Error"></output>
          <span data-derived="popover">${workflowFixture.rows.popover.derivedLabel}</span>
        </section>
      </main>
      <script>
        window.__featureTableEditRequests = [];
        window.__featureTableEditEvents = [];
        const sourceRows = {
          preview: { id: 'preview-1', name: 'Alpha' },
          map: { id: 'map-1', name: 'Harbor' },
          popover: { id: 'popover-1', name: 'Point A' },
        };
        const commit = ({ surface, nextValue, ok }) => {
          const previousValue = sourceRows[surface].name;
          const origin = surface === 'popover' ? 'map-feature-popover' : 'preview-table';
          const request = {
            stagingRootNodeId: 'root-1',
            featureNodeId: sourceRows[surface].id,
            entityType: 'location',
            entityId: sourceRows[surface].id,
            fieldPath: 'name',
            previousValue,
            nextValue,
            dependencyStatus: surface === 'preview' ? 'active' : 'none',
            editOrigin: origin,
          };
          window.__featureTableEditRequests.push(request);
          window.__featureTableEditEvents.push({ surface, phase: 'pending', value: nextValue });
          const input = document.querySelector('[aria-label="' + (surface === 'preview' ? 'Preview' : surface === 'map' ? 'Map' : 'Popover') + ' Name"]');
          const output = document.querySelector('[aria-label="' + (surface === 'preview' ? 'Preview' : surface === 'map' ? 'Map' : 'Popover') + ' Error"]');
          if (ok) {
            sourceRows[surface].name = nextValue;
            input.value = nextValue;
            window.__featureTableEditEvents.push({
              surface,
              phase: 'success',
              value: nextValue,
              refreshHint: { entityId: request.entityId, fieldPath: request.fieldPath },
              rebuildPlan: surface === 'preview' ? 'rebuild-plan:edge-1' : undefined,
            });
            return;
          }
          input.value = previousValue;
          output.textContent = 'typed failure';
          window.__featureTableEditEvents.push({ surface, phase: 'failure', value: nextValue, error: 'typed failure' });
          window.__featureTableEditEvents.push({ surface, phase: 'rollback', value: previousValue, error: 'typed failure' });
        };
        window.__commitFeatureTableEdit = commit;
      </script>`);

    await page.evaluate(() => {
      window.__commitFeatureTableEdit({ surface: 'preview', nextValue: 'Beta', ok: true });
      window.__commitFeatureTableEdit({ surface: 'map', nextValue: 'Rejected', ok: false });
      window.__commitFeatureTableEdit({ surface: 'popover', nextValue: 'Point B', ok: true });
    });

    await expect(page.getByLabel('Preview Name')).toHaveValue('Beta');
    await expect(page.getByLabel('Map Name')).toHaveValue('Harbor');
    await expect(page.getByLabel('Map Error')).toHaveText('typed failure');
    await expect(page.getByLabel('Popover Name')).toHaveValue('Point B');
    await expect(page.locator('[data-derived="preview"]')).toHaveText('Display only');
    await expect(page.locator('[data-derived="map"]')).toHaveText('Distance 12km');
    await expect(page.locator('[data-derived="popover"]')).toHaveText('Centroid label');

    const requests = await page.evaluate(() => window.__featureTableEditRequests);
    expect(requests).toEqual([
      expect.objectContaining({
        editOrigin: 'preview-table',
        dependencyStatus: 'active',
        nextValue: 'Beta',
      }),
      expect.objectContaining({
        editOrigin: 'preview-table',
        dependencyStatus: 'none',
        nextValue: 'Rejected',
      }),
      expect.objectContaining({
        editOrigin: 'map-feature-popover',
        dependencyStatus: 'none',
        nextValue: 'Point B',
      }),
    ]);

    const events = await page.evaluate(() => window.__featureTableEditEvents);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          surface: 'preview',
          phase: 'success',
          rebuildPlan: 'rebuild-plan:edge-1',
        }),
        expect.objectContaining({ surface: 'map', phase: 'rollback', error: 'typed failure' }),
        expect.objectContaining({ surface: 'popover', phase: 'success' }),
      ])
    );
  });
});

declare global {
  interface Window {
    __commitFeatureTableEdit(input: {
      readonly surface: 'preview' | 'map' | 'popover';
      readonly nextValue: string;
      readonly ok: boolean;
    }): void;
    __featureTableEditEvents: unknown[];
    __featureTableEditRequests: unknown[];
  }
}
