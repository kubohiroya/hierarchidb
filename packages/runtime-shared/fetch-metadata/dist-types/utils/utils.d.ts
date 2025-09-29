import type { RegionMetadata } from './types.js';
/**
 * Ensure directory exists, create if not
 */
export declare function ensureDirectory(dirPath: string): Promise<void>;
/**
 * Save metadata to JSON file
 */
export declare function saveMetadata(data: RegionMetadata[], outputDirName: string, outputFileName: string): Promise<void>;
/**
 * Fetch data from URL with retry logic
 */
export declare function fetchWithRetry(url: string, maxRetries?: number, delay?: number): Promise<Response>;
//# sourceMappingURL=utils.d.ts.map