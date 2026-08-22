// NOTE: Module shims live under /types/*.d.ts (do not keep hand-maintained .d.ts under src/).

import type {
  DetectionResult,
  FileLike,
  ParseOptions,
  TabularChunk,
  TabularParseResult,
  TabularParserPort,
  TabularPreview,
} from '@hierarchidb/tabular-source';

// Uses 'xlsx' package, which is a dependency of this optional package
// to keep @hierarchidb/tabular-source core lean.

export const xlsxParser: TabularParserPort = {
  id: 'xlsx',
  detect(input: FileLike): DetectionResult {
    const name =
      typeof input === 'object' &&
      input !== null &&
      'name' in input &&
      typeof input.name === 'string'
        ? input.name.toLowerCase()
        : '';
    const type =
      typeof input === 'object' &&
      input !== null &&
      'type' in input &&
      typeof input.type === 'string'
        ? input.type.toLowerCase()
        : '';
    const confidence = name.endsWith('.xlsx') || type.includes('spreadsheet') ? 0.9 : 0.1;
    return { format: 'xlsx', confidence };
  },
  async parse(input: FileLike, options?: ParseOptions): Promise<TabularParseResult> {
    const xlsxModule = await import('xlsx/xlsx.mjs');
    const XLSX = ((xlsxModule as { default?: typeof import('xlsx/xlsx.mjs') }).default ??
      xlsxModule) as typeof import('xlsx/xlsx.mjs');

    // Ensure Node-specific helpers are disabled when running in the browser.
    if (
      typeof (XLSX as { set_fs?: (fs: unknown) => void }).set_fs === 'function' &&
      (XLSX.utils as { fs_stub?: unknown }).fs_stub
    ) {
      (XLSX as { set_fs: (fs: unknown) => void }).set_fs(
        (XLSX.utils as { fs_stub: unknown }).fs_stub
      );
    }

    const decodeBase64ToArrayBuffer = (base64: string): ArrayBuffer => {
      if (typeof globalThis.atob === 'function') {
        const binary = globalThis.atob(base64);
        const length = binary.length;
        const bytes = new Uint8Array(length);
        for (let idx = 0; idx < length; idx += 1) {
          bytes[idx] = binary.charCodeAt(idx);
        }
        return bytes.buffer;
      }
      type BufferCtor = {
        from(
          data: string,
          encoding: string
        ): Uint8Array & {
          buffer: ArrayBufferLike;
          byteOffset: number;
          byteLength: number;
        };
      };
      const bufferCtor = (globalThis as { Buffer?: BufferCtor }).Buffer;
      if (bufferCtor && typeof bufferCtor.from === 'function') {
        const nodeBuffer = bufferCtor.from(base64, 'base64');
        const { buffer, byteOffset, byteLength } = nodeBuffer;
        return (buffer as ArrayBuffer).slice(byteOffset, byteOffset + byteLength);
      }
      throw new Error('Base64 decoding is not supported in this environment.');
    };

    async function toArrayBuffer(i: FileLike): Promise<ArrayBuffer> {
      if (typeof Blob !== 'undefined' && i instanceof Blob) return await i.arrayBuffer();
      if (i instanceof ArrayBuffer) return i;
      if (ArrayBuffer.isView(i)) {
        const view = i as ArrayBufferView;
        const buffer = view.buffer as ArrayBuffer;
        return buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
      }
      if (typeof i === 'string') {
        if (/^data:/.test(i) || /;base64,/.test(i)) {
          const b64 = i.split(',').pop() as string;
          return decodeBase64ToArrayBuffer(b64);
        }
        const enc = new TextEncoder();
        return enc.encode(i).buffer;
      }
      const enc = new TextEncoder();
      return enc.encode(String(i)).buffer;
    }

    const buf = await toArrayBuffer(input);
    const wb = XLSX.read(buf, { type: 'array' });
    const wsName = wb.SheetNames[0];
    if (!wsName) {
      throw new Error('XLSX file does not contain any sheets');
    }
    const ws = wb.Sheets[wsName];
    if (!ws) {
      throw new Error(`Worksheet "${wsName}" is missing from XLSX workbook`);
    }
    const json = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Array<Record<string, unknown>>;
    const chunkSize = options?.chunkSize ?? 1000;

    const headers = json.length > 0 ? Object.keys(json[0] ?? {}) : [];
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
