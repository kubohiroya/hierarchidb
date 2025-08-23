export class UnifiedDownloadService {
  static async downloadFile(
    url: string,
    options?: {
      onProgress?: (progress: number) => void;
      signal?: AbortSignal;
    }
  ): Promise<Blob> {
    const { onProgress, signal } = options || {};

    const response = await fetch(url, { signal });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText}`);
    }

    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    let loaded = 0;

    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = [];

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        loaded += value.length;

        if (onProgress && total) {
          onProgress((loaded / total) * 100);
        }
      }
    }

    // Convert Uint8Array chunks to ArrayBuffer to avoid SharedArrayBuffer issues
    const buffers = chunks.map((chunk) => {
      // Create a new ArrayBuffer and copy the data
      const buffer = new ArrayBuffer(chunk.byteLength);
      const view = new Uint8Array(buffer);
      view.set(chunk);
      return buffer;
    });
    return new Blob(buffers);
  }
}
