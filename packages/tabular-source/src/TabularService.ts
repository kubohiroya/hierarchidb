import { createTabularLikeParser } from './parsers/createTabularLikeParser.js';
import { jsonlParser } from './parsers/jsonlParser.js';
import type { TabularContext, TabularProcessor } from './processor.js';
import { detectFormat, parseWithBest, registerParser } from './registryUtils.js';
import type { TabularIngestResult, TabularStorePort } from './storeTypes.js';
import type {
  DetectionResult,
  FileLike,
  ParseOptions,
  TabularParseResult,
  TabularRow,
  TabularSchema,
} from './types.js';

// Register built-in parsers by default
registerParser(createTabularLikeParser('csv', ','));
registerParser(createTabularLikeParser('tsv', '\t'));
registerParser(jsonlParser);

export class TabularService {
  async detect(input: FileLike): Promise<DetectionResult> {
    return await detectFormat(input);
  }

  async parse(input: FileLike, options?: ParseOptions): Promise<TabularParseResult> {
    return await parseWithBest(input, options);
  }

  async ingest<TMeta = unknown>(
    input: FileLike,
    store: TabularStorePort<TMeta>,
    options?: ParseOptions & {
      filename?: string;
      sizeBytes?: number;
      processors?: TabularProcessor[];
      context?: TabularContext;
    }
  ): Promise<TabularIngestResult<TMeta>> {
    const parsed = await this.parse(input, options);
    // Processor: mapSchema
    const baseSchema = parsed.preview.schema as TabularSchema;
    const ctx: TabularContext = { filename: options?.filename, userOptions: options };
    let schema: TabularSchema = baseSchema;
    for (const p of options?.processors ?? []) {
      if (p.mapSchema) schema = p.mapSchema(schema, ctx);
    }
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
        const transformed: TabularRow[] = [];
        for (const row of chunk.rows) {
          let r: TabularRow | null = row;
          for (const p of processors) {
            if (p.transformRow) {
              r = await p.transformRow(r, ctx);
              if (r === null) break;
            }
            if (p.validateRow && r !== null) {
              const errs = await p.validateRow(r, ctx);
              if (errs?.length) {
                r = null;
                break;
              }
            }
          }
          if (r) transformed.push(r);
        }
        await store.writeChunk(session, {
          rows: transformed,
          index: chunk.index,
          hasMore: chunk.hasMore,
        });
      }
      totalRows += chunk.rows.length;
      chunkCount += 1;
    }

    return await store.commit(session, { totalRows, chunkCount });
  }
}
