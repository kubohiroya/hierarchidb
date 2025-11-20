import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Blob as NodeBlob, File as NodeFile } from 'node:buffer';

const globalTarget = globalThis as any;
globalTarget.Blob = NodeBlob;
globalTarget.File = NodeFile;
if (globalTarget.window) {
  globalTarget.window.Blob = NodeBlob;
  globalTarget.window.File = NodeFile;
}

let SpreadsheetTabularApiDriver: typeof import('../services/SpreadsheetTabularApiDriver.js').SpreadsheetTabularApiDriver;
let SpreadsheetMetadataManager: typeof import('../services/SpreadsheetMetadataManager.js').SpreadsheetMetadataManager;

beforeAll(async () => {
  const driverModule = await import('../services/SpreadsheetTabularApiDriver.js');
  SpreadsheetTabularApiDriver = driverModule.SpreadsheetTabularApiDriver;
  const metadataModule = await import('../services/SpreadsheetMetadataManager.js');
  SpreadsheetMetadataManager = metadataModule.SpreadsheetMetadataManager;
});

const createFile = (content: string, name = 'test.csv'): File =>
  new NodeFile([content], name, { type: 'text/csv' }) as unknown as File;

describe('SpreadsheetTabularApiDriver', () => {
  let driver: SpreadsheetTabularApiDriver;

  beforeEach(() => {
    driver = new SpreadsheetTabularApiDriver(new SpreadsheetMetadataManager(), 'spreadsheet');
  });

  it('uploads a CSV file and infers column metadata', async () => {
    const csv = createFile('name,age\nAlice,32\nBob,28');
    const metadata = await driver.uploadCSVFile(csv);
    expect(metadata.totalRows).toBe(2);
    expect(metadata.columns).toHaveLength(2);
    expect(metadata.columns?.[0]?.name).toBe('name');
    expect(metadata.columns?.[1]?.type).toBe('number');
  });

  it('deduplicates identical uploads by content hash', async () => {
    const csvA = createFile('name\nAlice');
    const csvB = createFile('name\nAlice', 'another.csv');
    const first = await driver.uploadCSVFile(csvA);
    const second = await driver.uploadCSVFile(csvB);
    expect(second.id).toBe(first.id);
    expect(second.referenceCount).toBeGreaterThanOrEqual(1);
  });

  it('filters rows based on CSVFilterRule definitions', async () => {
    const csv = createFile('name,team\nAlice,Blue\nBob,Red\nCarol,Blue');
    const metadata = await driver.uploadCSVFile(csv);
    const result = await driver.getFilteredPreview(
      metadata.id,
      [
        {
          id: 'team-blue',
          column: 'team',
          operator: 'equals',
          value: 'Blue',
          enabled: true,
        },
      ],
      10,
    );
    expect(result.totalRows).toBe(2);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]?.team).toBe('Blue');
  });

  it('tracks references and deletes row data when the last reference is removed', async () => {
    const csv = createFile('name\nAlice');
    const metadata = await driver.uploadCSVFile(csv);
    await driver.addTableReference(metadata.id, 'styler');
    const afterAdd = await driver.getTableMetadata(metadata.id);
    expect(afterAdd?.referenceCount).toBe(2);
    await driver.removeTableReference(metadata.id, 'styler');
    await driver.removeTableReference(metadata.id, 'spreadsheet');
    const afterRemove = await driver.getTableMetadata(metadata.id);
    expect(afterRemove).toBeNull();
  });
});
