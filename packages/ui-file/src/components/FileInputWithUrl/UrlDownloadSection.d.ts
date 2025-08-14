import React from 'react';
interface UrlDownloadSectionProps {
  downloadUrl: string;
  isDownloading: boolean;
  disabled: boolean;
  loading: boolean;
  downloadError: string | undefined;
  downloadProgress: number | undefined;
  downloadSuccess: boolean;
  isAuthError: boolean;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  hoveredSection: 'drag' | 'url' | undefined;
  onUrlChange: (url: string) => void;
  handleDownload: () => void;
  onKeyPress: (event: React.KeyboardEvent) => void;
  onSignIn?: (provider?: any) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  compact?: boolean;
}
export declare const UrlDownloadSection: React.FC<UrlDownloadSectionProps>;
export {};
//# sourceMappingURL=UrlDownloadSection.d.ts.map
