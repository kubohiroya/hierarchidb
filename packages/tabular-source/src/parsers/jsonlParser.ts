import type { TabularParserPort } from '~/portTypes';
import type {
  DetectionResult,
  FileLike,
  ParseOptions,
  TabularChunk,
  TabularParseResult,
  TabularPreview,
  TabularRow,
} from '~/types';
import { isTabularRow } from '../tabularRowJsonSchema.js';

type FileMeta = { name?: string };

async function toText(input: FileLike): Promise<string> {
  if (typeof input === 'string') return input;
  if (typeof Blob !== 'undefined' && input instanceof Blob) return await input.text();
  if (input instanceof ArrayBuffer || input instanceof Uint8Array) {
    const dec = new TextDecoder('utf-8');
    const buf = input instanceof Uint8Array ? input : new Uint8Array(input);
    return dec.decode(buf);
  }
  return String(input);
}

function getFileMeta(input: FileLike): FileMeta {
  if (typeof input === 'object' && input !== null) {
    const candidate = input as Partial<FileMeta>;
    return { name: typeof candidate.name === 'string' ? candidate.name : undefined };
  }
  return {};
}

export const jsonlParser: TabularParserPort = {
  id: 'jsonl',
  detect(input: FileLike): DetectionResult {
    const meta = getFileMeta(input);
    const name = meta.name?.toLowerCase() ?? '';
    const confidence = name.endsWith('.jsonl') ? 0.8 : 0.2;
    return { format: 'jsonl', confidence };
  },
  async parse(input: FileLike, options?: ParseOptions): Promise<TabularParseResult> {
    const text = await toText(input);
    const lines = text.replace(/\r\n?/g, '\n').split('\n').filter(Boolean);
    const chunkSize = options?.chunkSize ?? 1000;

    const sample: TabularRow[] = [];
    let headers: string[] | undefined;

    if (lines.length === 0) {
      const preview: TabularPreview = { schema: { columns: [] }, sample: [], totalRows: 0 };

      async function* empty(): AsyncGenerator<TabularChunk> {
        /* no rows */
      }

      return { preview, [Symbol.asyncIterator]: () => empty() } as TabularParseResult;
    }

    async function* iterator(): AsyncGenerator<TabularChunk> {
      let buf: TabularRow[] = [];
      let idx = 0;
      for (const [i, line] of lines.entries()) {
        const obj = JSON.parse(line) as unknown;
        if (!isTabularRow(obj)) {
          throw new Error('jsonl-row-must-be-object');
        }
        const row = obj;
        if (!headers) headers = Object.keys(row);
        if (sample.length < 50) sample.push(row);
        buf.push(row);
        if (buf.length >= chunkSize) {
          const hasMore = i < lines.length - 1;
          yield { rows: buf, index: idx++, hasMore };
          buf = [];
        }
      }
      if (buf.length) {
        yield { rows: buf, index: Math.ceil(lines.length / chunkSize) - 1, hasMore: false };
      }
    }

    const preview: TabularPreview = {
      schema: { columns: (headers ?? []).map((h) => ({ name: h })) },
      sample,
      totalRows: lines.length,
    };

    return {
      preview,
      [Symbol.asyncIterator]: () => iterator(),
    };
  },
};
