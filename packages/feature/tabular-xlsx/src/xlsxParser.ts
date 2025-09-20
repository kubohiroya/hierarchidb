import type { TabularParserPort } from '@hierarchidb/tabular/ports';
import type {
  DetectionResult,
  FileLike,
  ParseOptions,
  TabularChunk,
  TabularParseResult,
  TabularPreview,
} from '@hierarchidb/tabular/types';

// Uses 'xlsx' package, which is a dependency of this optional package
// to keep @hierarchidb/tabular core lean.

export const xlsxParser: TabularParserPort = {
  id: 'xlsx',
  detect(input: FileLike): DetectionResult {
    const name = typeof input === 'object' && input !== null && 'name' in input && typeof input.name === 'string'
      ? input.name.toLowerCase()
      : '';
    const type = typeof input === 'object' && input !== null && 'type' in input && typeof input.type === 'string'
      ? input.type.toLowerCase()
      : '';
    const confidence = name.endsWith('.xlsx') || type.includes('spreadsheet') ? 0.9 : 0.1;
    return { format: 'xlsx', confidence };
  },
  async parse(input: FileLike, options?: ParseOptions): Promise<TabularParseResult> {
    const XLSX = require('xlsx');

    async function toArrayBuffer(i: FileLike): Promise<ArrayBuffer> {
      if (typeof Blob !== 'undefined' && i instanceof Blob) return await i.arrayBuffer();
      if (i instanceof ArrayBuffer) return i;
      if (i instanceof Uint8Array) return i.buffer as ArrayBuffer; // normalize ArrayBufferLike for TS 4.9
      if (typeof i === 'string') {
        if (/^data:/.test(i) || /;base64,/.test(i)) {
          const b64 = i.split(',').pop() as string;
          const bin = Buffer.from(b64, 'base64');
          return bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);
        }
        const enc = new TextEncoder();
        return enc.encode(i).buffer;
      }
      return Buffer.from(String(i)).buffer;
    }

    const buf = await toArrayBuffer(input);
    const wb = XLSX.read(buf, { type: 'array' });
    const wsName = wb.SheetNames[0];
    const ws = wb.Sheets[wsName];
    const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
    const chunkSize = options?.chunkSize ?? 1000;

    const headers = json.length > 0 ? Object.keys(json[0]) : [];
    const previewRows: Array<Record<string, unknown>> = json.slice(0, 50);

    async function* iterator(): AsyncGenerator<TabularChunk> {
      let index = 0;
      for (let i = 0; i < json.length; i += chunkSize) {
        const slice = json.slice(i, i + chunkSize) as Array<Record<string, unknown>>;
        const hasMore = i + chunkSize < json.length;
        yield { rows: slice, index: index++, hasMore };
      }
    }

    const preview: TabularPreview = {
      schema: { columns: headers.map((h) => ({ name: h })) },
      sample: previewRows,
      totalRows: json.length,
    };

    return {
      preview,
      [Symbol.asyncIterator]: () => iterator(),
    };
  },
};
