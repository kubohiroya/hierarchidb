let downloadEnabled = false;

export function enableDownload(): void {
  downloadEnabled = true;
}

export function disableDownload(): void {
  downloadEnabled = false;
}

export function isDownloadEnabled(): boolean {
  return downloadEnabled;
}
