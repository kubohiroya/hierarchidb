export declare class UnifiedDownloadService {
  static downloadFile(
    url: string,
    options?: {
      onProgress?: (progress: number) => void;
      signal?: AbortSignal;
    }
  ): Promise<Blob>;
}
//# sourceMappingURL=UnifiedDownloadService.d.ts.map
