interface UseUrlDownloadProps {
  accept: string;
  disabled: boolean;
  loading: boolean;
  defaultDownloadUrl?: string;
  handleFileSelect: (file: File, downloadUrl?: string) => void | Promise<void>;
  handleUrlDownload?: (url: string) => Promise<void>;
  onDownloadProgress?: (progress: number | undefined) => void;
}
interface UseUrlDownloadReturn {
  downloadUrl: string;
  setDownloadUrl: (url: string) => void;
  isDownloading: boolean;
  downloadError: string | undefined;
  downloadProgress: number | undefined;
  downloadSuccess: boolean;
  isAuthError: boolean;
  handleDownload: () => Promise<void>;
  handleKeyPress: (event: React.KeyboardEvent) => void;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  signIn: (provider?: string) => void;
}
export declare function useUrlDownload({
  accept,
  disabled,
  loading,
  defaultDownloadUrl,
  handleFileSelect,
  handleUrlDownload,
  onDownloadProgress,
}: UseUrlDownloadProps): UseUrlDownloadReturn;
export {};
//# sourceMappingURL=useUrlDownload.d.ts.map
