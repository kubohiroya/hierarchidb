export async function downloadFile(
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
  const total = contentLength ? Number.parseInt(contentLength, 10) : 0;
  let loaded = 0;

  const reader = response.body?.getReader();
  const contentType = response.headers.get('content-type') ?? '';
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

  const buffers = chunks.map((chunk) => {
    const buffer = new ArrayBuffer(chunk.byteLength);
    const view = new Uint8Array(buffer);
    view.set(chunk);
    return buffer;
  });
  return new Blob(buffers, { type: contentType });
}

export const UnifiedDownloadService = {
  downloadFile,
};
