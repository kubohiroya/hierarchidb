import type { TabularParserPort } from '../ports';
import type { DetectionResult, FileLike, ParseOptions, TabularChunk, TabularParseResult, TabularPreview } from '../types';

async function toText(input: FileLike): Promise<string> {
  if (typeof input === 'string') return input;
  if (typeof Blob !== 'undefined' && input instanceof Blob) return await input.text();
  if (input instanceof ArrayBuffer || input instanceof Uint8Array) {
    const dec = new TextDecoder('utf-8');
    const buf = input instanceof Uint8Array ? input : new Uint8Array(input);
    return dec.decode(buf);
  }
  return String(input as any);
}

export const jsonlParser: TabularParserPort = {
  id: 'jsonl',
  detect(input: FileLike): DetectionResult {
    const name = (input as any).name?.toLowerCase?.() || '';
    let confidence = name.endsWith('.jsonl') ? 0.8 : 0.2;
    return { format: 'jsonl', confidence };
  },
  async parse(input: FileLike, options?: ParseOptions): Promise<TabularParseResult> {
    const text = await toText(input);
    const lines = text.replace(/\r\n?/g, '\n').split('\n').filter(Boolean);
    const chunkSize = options?.chunkSize ?? 1000;

    const sample: Record<string, any>[] = [];
    let headers: string[] | undefined;

    if (lines.length === 0) {
      const preview: TabularPreview = { schema: { columns: [] }, sample: [], totalRows: 0 };
      async function* empty(): AsyncGenerator<TabularChunk> { /* no rows */ }
      return { preview, [Symbol.asyncIterator]: () => empty() } as TabularParseResult;
    }

    async function* iterator(): AsyncGenerator<TabularChunk> {
      let buf: Record<string, any>[] = [];
      let idx = 0;
      for (const [i, line] of lines.entries()) {
        const obj = JSON.parse(line);
        if (!headers) headers = Object.keys(obj);
        if (sample.length < 50) sample.push(obj);
        buf.push(obj);
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
