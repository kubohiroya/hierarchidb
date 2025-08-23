interface UseFileInputProps {
  onFileSelect: (file: File, downloadUrl?: string) => void | Promise<void>;
}
interface UseFileInputReturn {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  localError: string | null;
  setLocalError: (error: string | null) => void;
  setDownloadError: (error: string | null) => void;
  handleFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
}
export declare function useFileInput({ onFileSelect }: UseFileInputProps): UseFileInputReturn;
export {};
//# sourceMappingURL=useFileInput.d.ts.map
