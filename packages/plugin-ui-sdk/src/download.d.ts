import { createDownloadService } from '@hierarchidb/download';
export { createDownloadService } from '@hierarchidb/download';
import type { DownloadOptions, DownloadResult } from '@hierarchidb/download';
export type DownloadServiceHandle = Awaited<ReturnType<typeof createDownloadService>>;
export interface DownloadTaskOptions {
    /**
     * Allows callers to rewrite the requested URL (e.g., to route through a proxy).
     */
    transformUrl?: (url: string) => string | Promise<string>;
    /**
     * Override the file identifier used when storing chunks. Accepts a string or factory.
     */
    fileId?: string | ((resolvedUrl: string) => string);
    /**
     * Additional download options forwarded to the underlying service.
     */
    downloadOptions?: DownloadOptions;
    /**
     * Whether to issue a lightweight HEAD request to collect response headers (default: true).
     */
    captureMetadata?: boolean;
    /**
     * Hook invoked after the download completes, with helpers to read the stored content.
     */
    onComplete?: (outcome: ManagedDownloadOutcome) => Promise<void> | void;
}
export interface ManagedDownloadOutcome extends DownloadResult {
    /** Final URL after any transforms. */
    url: string;
    /** Lazily reads the full downloaded payload from storage. */
    readAll: () => Promise<ArrayBuffer>;
    /** Content-Type derived from HEAD response (if available). */
    contentType?: string;
}
export declare function downloadWithService(service: DownloadServiceHandle, originalUrl: string, options?: DownloadTaskOptions): Promise<ManagedDownloadOutcome>;
//# sourceMappingURL=download.d.ts.map