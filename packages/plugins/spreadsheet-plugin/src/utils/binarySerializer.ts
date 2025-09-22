/**
  * @file binarySerializer.ts
 * @description
 * Row data to ArrayBuffer conversion with compression support
  */

import * as pako from 'pako';
import type { ChunkBinaryFormat, ProcessingStats } from '../types/index.js';

/**
  * : ArrayBuffer
 * :
 * : BinarySerialization.test.ts
 * :
 * @param rows -
 * @param columnTypes -
 * @param compressionType - 'none'
 * @returns ArrayBuffer -
  */
export function serializeRowsToArrayBuffer(
  rows: Array<Record<string, any>>,
  columnTypes: ('string' | 'number' | 'date' | 'boolean')[],
  compressionType: 'none' | 'gzip' | 'lz4' = 'none',
): ArrayBuffer {
  //  :
  if (compressionType !== 'none' && compressionType !== 'gzip') {
    throw new Error(`Compression type '${compressionType}' is not supported`);
  }

  //  :
  if (rows.length === 0) {
    return createEmptyBinaryFormat(columnTypes, compressionType);
  }

  //  : + ArrayBuffer
  const format: ChunkBinaryFormat = {
    version: 1,
    compression: compressionType,
    encoding: 'utf8',
    columnTypes: columnTypes,
    rowData: new ArrayBuffer(0),
  };

  //  : JSON
  const jsonString = JSON.stringify(rows);
  const textEncoder = new TextEncoder();
  const jsonBytes = textEncoder.encode(jsonString);

  //  : gzippako
  let finalData: Uint8Array;
  if (compressionType === 'gzip') {
    //  gzip: pakogzip
    finalData = pako.gzip(jsonBytes);
  } else {
    finalData = jsonBytes;
  }

  //  ArrayBuffer: +
  return createBinaryFormat(format, finalData);
}

/**
  * : ArrayBuffer
 * :
 * :
 * :
 * @param buffer -
 * @param columnTypes -
 * @returns Array<Record<string, any>> -
  */
export function deserializeRowsFromArrayBuffer(
  buffer: ArrayBuffer,
  columnTypes: ('string' | 'number' | 'date' | 'boolean')[],
): Array<Record<string, any>> {
  //  :
  if (!buffer || buffer.byteLength === 0) {
    return [];
  }

  //  :
  if (buffer.byteLength < 16) {
    throw new Error('Incomplete data detected - size mismatch');
  }

  try {
    //  :
    const formatInfo = getBinaryFormatInfo(buffer);

    //  :
    if (!arraysEqual(formatInfo.columnTypes, columnTypes)) {
      throw new Error('Column type mismatch detected');
    }

    //  :
    const dataBuffer = formatInfo.rowData;

    //  :
    let decompressedData: Uint8Array;
    if (formatInfo.compression === 'gzip') {
      //  pakogzip
      decompressedData = pako.ungzip(new Uint8Array(dataBuffer));
    } else {
      decompressedData = new Uint8Array(dataBuffer);
    }

    //  JSON: JSON
    const textDecoder = new TextDecoder();
    const jsonString = textDecoder.decode(decompressedData);
    const rows = JSON.parse(jsonString);

    return rows;
  } catch (error) {
    //  :
    if (error instanceof Error) {
      if (error.message.includes('size') || error.message.includes('incomplete')) {
        throw new Error('Size mismatch - incomplete data');
      }

      if (error.message.includes('Corrupted binary format header')) {
        //  size mismatch
        if (buffer.byteLength < 64) {
          throw new Error('Size mismatch - incomplete data');
        }
        throw new Error('Corrupted binary format header');
      }

      //  JSON
      if (error.message.includes('JSON') || error.message.includes('parse')) {
        throw new Error('Size mismatch - incomplete data');
      }

      if (error.message.includes('column.*type')) {
        throw new Error('Column type mismatch detected');
      }
    }
    throw error;
  }
}

/**
  * :
 * : ArrayBuffer
 * :
 * :
  */
export function getBinaryFormatInfo(buffer: ArrayBuffer): ChunkBinaryFormat {
  //  :
  if (buffer.byteLength < 16) {
    throw new Error('Corrupted binary format header');
  }

  try {
    //  :
    const view = new DataView(buffer);
    const headerBytes = new Uint8Array(buffer, 0, 16);

    //  :
    if (headerBytes[0] !== 0x53 || headerBytes[1] !== 0x50) { // "SP" (SpreadsheetPlugin)
      throw new Error('Corrupted binary format header');
    }

    //  :
    const version = view.getUint8(2);

    //  :
    const compressionFlag = view.getUint8(3);
    const compression: 'none' | 'gzip' | 'lz4' =
      compressionFlag === 1 ? 'gzip' :
        compressionFlag === 2 ? 'lz4' : 'none';

    //  :
    const columnTypesLength = view.getUint32(4, true);
    const columnTypesStart = 16;
    const columnTypesEnd = columnTypesStart + columnTypesLength;

    if (buffer.byteLength < columnTypesEnd) {
      throw new Error('Size mismatch or incomplete data detected');
    }

    const columnTypesBytes = new Uint8Array(buffer, columnTypesStart, columnTypesLength);
    const columnTypesString = new TextDecoder().decode(columnTypesBytes);
    const columnTypes = JSON.parse(columnTypesString) as ('string' | 'number' | 'date' | 'boolean')[];

    //  :
    const rowDataStart = columnTypesEnd;
    const rowData = buffer.slice(rowDataStart);

    return {
      version,
      compression,
      encoding: 'utf8',
      columnTypes,
      rowData,
    };
  } catch (error) {
    //  :
    throw new Error('Corrupted binary format header');
  }
}

/**
  * :
 * :
 * :
 * :
  */
export function calculateCompressionRatio(originalSize: number, compressedSize: number): number {
  //  : 0
  if (compressedSize === 0) {
    return originalSize > 0 ? Infinity : 1.0;
  }

  //  : /
  return originalSize / compressedSize;
}

/**
  * :
 * :
 * :
 * :
  */
export function measureSerializationPerformance<T>(fn: () => T): { result: T; stats: ProcessingStats } {
  //  :
  const startTime = Date.now();
  const startMemory = getMemoryUsage();

  //  :
  const result = fn();

  //  :
  const endTime = Date.now();
  const endMemory = getMemoryUsage();

  //  :
  const stats: ProcessingStats = {
    chunkProcessingTime: 0, filterApplicationTime: 0, binarySerializationTime: endTime - startTime,
    memoryUsage: Math.max(0, endMemory - startMemory),
    diskUsage: 0,
  };

  return { result, stats };
}

// ============================================================================
// Private Helper Functions
// ============================================================================

/**
  * :
 * : ArrayBuffer
 * :
  */
function createEmptyBinaryFormat(
  columnTypes: ('string' | 'number' | 'date' | 'boolean')[],
  compressionType: 'none' | 'gzip' | 'lz4',
): ArrayBuffer {
  //  : JSON
  const emptyArray = JSON.stringify([]);
  const textEncoder = new TextEncoder();
  const emptyData = textEncoder.encode(emptyArray);

  const format: ChunkBinaryFormat = {
    version: 1,
    compression: compressionType,
    encoding: 'utf8',
    columnTypes: columnTypes,
    rowData: new ArrayBuffer(0),
  };

  return createBinaryFormat(format, emptyData);
}

/**
  * :
 * : + ArrayBuffer
 * :
  */
function createBinaryFormat(format: ChunkBinaryFormat, data: Uint8Array): ArrayBuffer {
  //  : JSON
  const columnTypesString = JSON.stringify(format.columnTypes);
  const columnTypesBytes = new TextEncoder().encode(columnTypesString);

  //  : +
  const headerSize = 16;
  const totalSize = headerSize + columnTypesBytes.length + data.length;

  //  ArrayBuffer:
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  //  : +
  bytes[0] = 0x53; // 'S'
  bytes[1] = 0x50; // 'P' (SpreadsheetPlugin)
  view.setUint8(2, format.version);
  view.setUint8(3, format.compression === 'gzip' ? 1 : format.compression === 'lz4' ? 2 : 0);
  view.setUint32(4, columnTypesBytes.length, true);

  //  :
  bytes.set(columnTypesBytes, headerSize);

  //  :
  bytes.set(data, headerSize + columnTypesBytes.length);

  return buffer;
}

/**
  * :
 * :
 * :
  */
function arraysEqual<T>(a: T[], b: T[]): boolean {
  //  :
  if (a.length !== b.length) {
    return false;
  }

  //  :
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }

  return true;
}

/**
  * :
 * : performance.memory
 * :
  */
type PerformanceWithMemory = Performance & {
  memory?: {
    usedJSHeapSize?: number;
  };
};

function getMemoryUsage(): number {
  if (typeof performance !== 'undefined') {
    const perf = performance as PerformanceWithMemory;
    const usage = perf.memory?.usedJSHeapSize;
    if (typeof usage === 'number') return usage;
  }

  //  :
  return Date.now() % 1000000;
}
