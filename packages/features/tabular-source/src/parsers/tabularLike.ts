import type { TabularParserPort } from '../ports.js';
import type {
  DetectionResult,
  FileLike,
  ParseOptions,
  TabularChunk,
  TabularParseResult,
  TabularPreview,
} from '../types.js';

type FileMeta = { name?: string; type?: string };

async function toText(input: FileLike, encoding?: string): Promise<string> {
  if (typeof input === 'string') return input;
  if (typeof Blob !== 'undefined' && input instanceof Blob) {
    return await input.text();
  }
  if (input instanceof ArrayBuffer || input instanceof Uint8Array) {
    const dec = new TextDecoder(encoding ?? 'utf-8');
    const buf = input instanceof Uint8Array ? input : new Uint8Array(input);
    return dec.decode(buf);
  }
  // Fallback
  return String(input);
}

function getFileMeta(input: FileLike): FileMeta {
  if (typeof input === 'object' && input !== null) {
    const candidate = input as Partial<FileMeta>;
    const name = typeof candidate.name === 'string' ? candidate.name : undefined;
    const type = typeof candidate.type === 'string' ? candidate.type : undefined;
    return { name, type };
  }
  return {};
}

function splitLines(text: string): string[] {
  return text.replace(/\r\n?/g, '\n').split('\n');
}

function simpleTabularSplit(line: string, delimiter: string): string[] {
  // NOTE: intentionally simple; does not handle quotes/escapes fully.
  // Good enough as a placeholder until a robust CSV impl is added.
  return line.split(delimiter);
}

export function createTabularLikeParser(id: 'csv' | 'tsv', delimiter: string): TabularParserPort {
  return {
    id,
    detect(input: FileLike): DetectionResult {
      const meta = getFileMeta(input);
      const name = meta.name?.toLowerCase() ?? '';
      const type = meta.type?.toLowerCase() ?? '';
      const ext = id === 'csv' ? '.csv' : '.tsv';
      const mime = id === 'csv' ? 'text/csv' : 'text/tab-separated-values';
      let confidence = 0;
      if (name.endsWith(ext)) confidence = 0.9;
      else if (type.includes(mime)) confidence = 0.7;
      return { format: id, confidence };
    },
    async parse(input: FileLike, options?: ParseOptions): Promise<TabularParseResult> {
      const text = await toText(input, options?.encoding);
      const lines = splitLines(text).filter((l) => l.length > 0);
      const headerOn = options?.header !== false;
      const chunkSize = options?.chunkSize ?? 1000;

      if (lines.length === 0) {
        const preview: TabularPreview = { schema: { columns: [] }, sample: [], totalRows: 0 };

        async function* empty(): AsyncGenerator<TabularChunk> { /* no rows */
        }

        return { preview, [Symbol.asyncIterator]: () => empty() } as TabularParseResult;
      }

      let headers: string[];
      let startIdx = 0;
      if (headerOn) {
        headers = simpleTabularSplit(lines[0]!, delimiter);
        startIdx = 1;
      } else {
        const first = simpleTabularSplit(lines[0]!, delimiter);
        headers = first.map((_, i) => `col${i + 1}`);
      }

      const previewRows: Record<string, any>[] = [];

      async function* iterator(): AsyncGenerator<TabularChunk> {
        let buf: Record<string, any>[] = [];
        let chunkIndex = 0;
        for (let i = startIdx; i < lines.length; i++) {
          const parts = simpleTabularSplit(lines[i]!, delimiter);
          const row: Record<string, any> = {};
          headers.forEach((h, idx) => (row[h] = parts[idx] ?? ''));
          if (previewRows.length < 50) previewRows.push(row);
          buf.push(row);
          if (buf.length >= chunkSize) {
            const hasMore = i < lines.length - 1;
            yield { rows: buf, index: chunkIndex++, hasMore };
            buf = [];
          }
        }
        if (buf.length > 0) {
          yield { rows: buf, index: Math.ceil((lines.length - startIdx) / chunkSize) - 1, hasMore: false };
        }
      }

      const preview: TabularPreview = {
        schema: { columns: headers.map((h) => ({ name: h })) },
        sample: previewRows,
        totalRows: Math.max(0, lines.length - startIdx),
      };

      const asyncIterable: TabularParseResult = {
        preview,
        [Symbol.asyncIterator]: () => iterator(),
      };
      return asyncIterable;
    },
  };
}
