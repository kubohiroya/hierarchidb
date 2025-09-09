import { type FileLike, TabularService } from '@hierarchidb/tabular';
import type { SimpleTableMetadataManager } from '@hierarchidb/table-metadata';
type CSVTableMetadataLike = Parameters<SimpleTableMetadataManager['create']>[0];
import { SpreadsheetStorePort } from './SpreadsheetStorePort';

export class SpreadsheetTabularDriver {
  constructor(private pluginId: string = 'spreadsheet') {
  }

  async ingestFile(file: File): Promise<CSVTableMetadataLike> {
    const tabular = new TabularService();
    const store = new SpreadsheetStorePort(this.pluginId);
    const result = await tabular.ingest(file as unknown as FileLike, store, {
      filename: file.name,
      sizeBytes: file.size,
    });
    return result.metadata;
  }
}
