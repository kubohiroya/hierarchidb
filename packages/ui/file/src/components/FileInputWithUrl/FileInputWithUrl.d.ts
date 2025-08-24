import React from 'react';
export interface FileInputWithUrlProps {
  /**
   * Callback when a file is selected or downloaded
   */
  onFileSelect: (file: File, downloadUrl?: string) => void | Promise<void>;
  /**
   * Accepted file types (e.g., ".csv,.xlsx,.zip")
   */
  accept?: string;
  /**
   * Display label for the file selection button
   */
  buttonLabel?: string;
  /**
   * Whether the component is in a loading state
   */
  loading?: boolean;
  /**
   * Error message to display
   */
  error?: string | null;
  /**
   * Whether to show the URL download option
   */
  showUrlDownload?: boolean;
  /**
   * Custom instructions to display
   */
  instructions?: React.ReactNode;
  /**
   * Whether the component is disabled
   */
  disabled?: boolean;
  /**
   * Additional styles for the root container
   */
  sx?: object;
  /**
   * Optional custom URL download handler (if not provided, built-in handler will be used)
   */
  onUrlDownload?: (url: string) => Promise<void>;
  /**
   * Default URL to populate the download field
   */
  defaultDownloadUrl?: string;
  /**
   * Callback for download progress updates
   */
  onDownloadProgress?: (progress: number | undefined) => void;
  /**
   * Layout orientation - horizontal layout with compact styling
   */
  layout?: 'vertical' | 'horizontal';
}
export declare const FileInputWithUrl: React.FC<FileInputWithUrlProps>;
//# sourceMappingURL=FileInputWithUrl.d.ts.map
