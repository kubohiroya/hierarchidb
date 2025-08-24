interface UseDragDropProps {
  accept: string;
  disabled: boolean;
  loading: boolean;
  isDownloading: boolean;
  onFileSelect: (file: File, downloadUrl?: string) => void | Promise<void>;
  setLocalError: (error: string | null) => void;
  setDownloadError: (error: string | null) => void;
}
interface UseDragDropReturn {
  isDragging: boolean;
  handleDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  handleDragLeave: (event: React.DragEvent<HTMLDivElement>) => void;
  handleDrop: (event: React.DragEvent<HTMLDivElement>) => Promise<void>;
}
export declare function useDragDrop({
  accept,
  disabled,
  loading,
  isDownloading,
  onFileSelect,
  setLocalError,
  setDownloadError,
}: UseDragDropProps): UseDragDropReturn;
export {};
//# sourceMappingURL=useDragDrop.d.ts.map
