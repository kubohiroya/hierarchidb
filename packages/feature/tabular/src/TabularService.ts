import type { FileLike, ParseOptions, TabularParseResult, DetectionResult } from './types';
import { registerParser, parseWithBest, listParsers, detectFormat } from './registry';
import { createCsvLikeParser } from './parsers/csvLike';
import { jsonlParser } from './parsers/jsonl';
import type { TabularStorePort, TabularIngestResult } from './store';
import type { FileLike, ParseOptions } from './types';
import type { TabularProcessor, TabularContext } from './processor';

// Register built-in parsers by default
registerParser(createCsvLikeParser('csv', ','));
registerParser(createCsvLikeParser('tsv', '\t'));
registerParser(jsonlParser);

export class TabularService {
  async detect(input: FileLike): Promise<DetectionResult> {
    return await detectFormat(input);
  }

  async parse(input: FileLike, options?: ParseOptions): Promise<TabularParseResult> {
    return await parseWithBest(input, options);
  }

  async ingest<TMeta = any>(
    input: FileLike,
    store: TabularStorePort<TMeta>,
    options?: ParseOptions & { filename?: string; sizeBytes?: number; processors?: TabularProcessor[]; context?: TabularContext }
  ): Promise<TabularIngestResult<TMeta>> {
    const parsed = await this.parse(input, options);
    // Processor: mapSchema
    const baseSchema = parsed.preview.schema;
    const ctx: TabularContext = { filename: options?.filename, userOptions: options };
    const schema = (options?.processors || []).reduce((acc, p) => (p.mapSchema ? { columns: p.mapSchema(acc, ctx).columns } : acc), baseSchema);
    const session = await store.beginIngest(schema, {
      filename: options?.filename,
      sizeBytes: options?.sizeBytes,
      source: input,
      format: (await this.detect(input)).format,
    });

    let totalRows = 0;
    let chunkCount = 0;
    for await (const chunk of parsed) {
      const processors = options?.processors || [];
      if (processors.length === 0) {
        await store.writeChunk(session, chunk);
      } else {
        const transformed: any[] = [];
        for (const row of chunk.rows) {
          let r: any | null = row;
          for (const p of processors) {
            if (p.transformRow) { r = await p.transformRow(r, ctx); if (r === null) break; }
            if (p.validateRow) {
              const errs = await p.validateRow(r!, ctx);
              if (errs?.length) { r = null; break; }
            }
          }
          if (r) transformed.push(r);
        }
        await store.writeChunk(session, { rows: transformed, index: chunk.index, hasMore: chunk.hasMore });
      }
      totalRows += chunk.rows.length;
      chunkCount += 1;
    }

    return await store.commit(session, { totalRows, chunkCount });
  }
}
