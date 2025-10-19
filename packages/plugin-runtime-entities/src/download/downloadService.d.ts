import { createDownloadService } from '@hierarchidb/download';
import type { DownloadOptions, DownloadResult } from '@hierarchidb/download';
export type DownloadServiceHandle = Awaited<ReturnType<typeof createDownloadService>>;
export interface DownloadTaskOptions {
    transformUrl?: (url: string) => string | Promise<string>;
    fileId?: string | ((resolvedUrl: string) => string);
    downloadOptions?: DownloadOptions;
    captureMetadata?: boolean;
    onComplete?: (outcome: ManagedDownloadOutcome) => Promise<void> | void;
}
export interface ManagedDownloadOutcome extends DownloadResult {
    url: string;
    readAll: () => Promise<ArrayBuffer>;
    contentType?: string;
}
export declare function downloadWithService(service: DownloadServiceHandle, originalUrl: string, options?: DownloadTaskOptions): Promise<ManagedDownloadOutcome>;
export { createDownloadService };
//# sourceMappingURL=downloadService.d.ts.map