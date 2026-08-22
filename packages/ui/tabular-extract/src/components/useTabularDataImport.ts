import type { TabularTableMetadata } from '@hierarchidb/tabular-store';
import type { SelectChangeEvent } from '@mui/material/Select';
import {
  type ChangeEvent,
  type DragEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { useTabularData } from '../hooks/useTabularData';
import type { TabularProcessingConfig } from '../types/index';

interface UseTabularDataImportArgs {
  onFileImported: (metadata: TabularTableMetadata) => void;
  onError: (error: string) => void;
  disabled: boolean;
  acceptedFileTypes: string[];
  maxFileSize: number;
  pluginId: string;
  nodeId?: string;
  menuContainer?: Element | null;
  initialImportMethod: 'file' | 'url';
  initialUrl: string;
  initialProcessingConfig?: TabularProcessingConfig;
  onProcessingConfigChange?: (config: TabularProcessingConfig) => void;
  onImportMethodChange?: (method: 'file' | 'url') => void;
  onUrlChange?: (url: string) => void;
  importSucceeded: boolean;
  autoStartDownload: boolean;
}

const defaultProcessingConfig: TabularProcessingConfig = {
  delimiter: ',',
  encoding: 'utf-8',
  hasHeader: true,
  quoteChar: '"',
  escapeChar: '\\',
  skipEmptyLines: true,
};

export const useTabularDataImport = ({
  onFileImported,
  onError,
  disabled,
  acceptedFileTypes,
  maxFileSize,
  pluginId,
  nodeId,
  menuContainer,
  initialImportMethod,
  initialUrl,
  initialProcessingConfig,
  onProcessingConfigChange,
  onImportMethodChange,
  onUrlChange,
  importSucceeded,
  autoStartDownload,
}: UseTabularDataImportArgs) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [urlInput, setUrlInput] = useState(initialUrl);
  const [importMethod, setImportMethod] = useState<'file' | 'url'>(initialImportMethod);
  const [processingConfig, setProcessingConfig] = useState<TabularProcessingConfig>(
    initialProcessingConfig ?? defaultProcessingConfig
  );
  const [dragActive, setDragActive] = useState(false);
  const [dragError, setDragError] = useState(false);
  const dragDepthRef = useRef(0);
  const autoDownloadTriggeredRef = useRef(false);

  const { importTabularFile, downloadTabularFromUrl, isImporting, imortError } = useTabularData({
    pluginId,
    nodeId,
    onImportSuccess: onFileImported,
    onImportError: onError,
  });

  const idPrefix = useId();
  const importMethodLabelId = `${idPrefix}-import-method`;
  const delimiterLabelId = `${idPrefix}-delimiter`;
  const encodingLabelId = `${idPrefix}-encoding`;
  const quoteLabelId = `${idPrefix}-quote-char`;
  const modalRoot = menuContainer ?? null;
  const showDownloadSuccess = importMethod === 'url' && importSucceeded;
  const urlFieldId = `${idPrefix}-tabular-url`;
  const importMethodSelectId = `${importMethodLabelId}-select`;
  const delimiterSelectId = `${delimiterLabelId}-select`;
  const encodingSelectId = `${encodingLabelId}-select`;
  const quoteSelectId = `${quoteLabelId}-select`;
  const hasHeaderSwitchId = `${idPrefix}-has-header`;
  const skipEmptyLinesSwitchId = `${idPrefix}-skip-empty-lines`;

  useEffect(() => {
    setImportMethod(initialImportMethod);
  }, [initialImportMethod]);

  useEffect(() => {
    setUrlInput(initialUrl);
  }, [initialUrl]);

  const processFile = useCallback(
    (file: File) => {
      const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;
      if (!acceptedFileTypes.includes(fileExtension)) {
        onError(
          `Unsupported file type: ${fileExtension}. Accepted types: ${acceptedFileTypes.join(', ')}`
        );
        return;
      }
      if (file.size > maxFileSize) {
        onError(
          `File size (${Math.round(file.size / 1024 / 1024)}MB) exceeds maximum allowed size (${Math.round(maxFileSize / 1024 / 1024)}MB)`
        );
        return;
      }
      importTabularFile(file, processingConfig);
    },
    [acceptedFileTypes, importTabularFile, maxFileSize, onError, processingConfig]
  );

  const handleFileSelect = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      processFile(file);
    },
    [processFile]
  );

  const handleUrlDownload = useCallback(() => {
    if (!urlInput.trim()) {
      onError('Please enter a valid URL');
      return;
    }
    try {
      new URL(urlInput);
      downloadTabularFromUrl(urlInput, processingConfig);
    } catch {
      onError('Invalid URL format');
    }
  }, [downloadTabularFromUrl, onError, processingConfig, urlInput]);

  useEffect(() => {
    if (!autoStartDownload) {
      autoDownloadTriggeredRef.current = false;
      return;
    }
    if (autoDownloadTriggeredRef.current) return;
    if (disabled || isImporting) return;
    if (importMethod !== 'url') return;
    if (!urlInput.trim()) return;
    if (importSucceeded) return;
    autoDownloadTriggeredRef.current = true;
    handleUrlDownload();
  }, [
    autoStartDownload,
    disabled,
    handleUrlDownload,
    importMethod,
    importSucceeded,
    isImporting,
    urlInput,
  ]);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const hasFileItems = useCallback((dt: DataTransfer | null): boolean => {
    if (!dt) return false;
    if (dt.items && dt.items.length > 0) {
      return Array.from(dt.items).some((item) => item.kind === 'file');
    }
    if (dt.types?.includes?.('Files')) return true;
    return Boolean(dt.files && dt.files.length > 0);
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragActive(false);
      setDragError(false);
      dragDepthRef.current = 0;
      if (disabled || isImporting) return;
      const file = event.dataTransfer.files?.[0];
      if (!file) return;
      processFile(file);
    },
    [disabled, isImporting, processFile]
  );

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!hasFileItems(event.dataTransfer)) return;
      event.preventDefault();
      event.stopPropagation();
      if (disabled || isImporting) return;
      setDragActive(true);
    },
    [disabled, hasFileItems, isImporting]
  );

  const handleDragEnter = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!hasFileItems(event.dataTransfer)) return;
      event.preventDefault();
      event.stopPropagation();
      if (disabled || isImporting) return;
      dragDepthRef.current += 1;
      const item = event.dataTransfer?.items?.[0];
      const file = item?.kind === 'file' ? item.getAsFile() : null;
      const name = file?.name || item?.type || '';
      const ext = name.includes('.') ? `.${name.split('.').pop()?.toLowerCase()}` : '';
      const matches = ext !== '' && acceptedFileTypes.includes(ext);
      setDragActive(matches);
      setDragError(!matches);
    },
    [acceptedFileTypes, disabled, hasFileItems, isImporting]
  );

  const handleDragLeave = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!hasFileItems(event.dataTransfer)) {
        setDragActive(false);
        setDragError(false);
        dragDepthRef.current = 0;
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) {
        setDragActive(false);
        setDragError(false);
      }
    },
    [hasFileItems]
  );

  const updateProcessingConfig = useCallback(
    (updater: (prev: TabularProcessingConfig) => TabularProcessingConfig) => {
      setProcessingConfig((prev) => {
        const next = updater(prev);
        onProcessingConfigChange?.(next);
        return next;
      });
    },
    [onProcessingConfigChange]
  );

  const handleImportMethodChange = useCallback(
    (event: SelectChangeEvent) => {
      const method = event.target.value as 'file' | 'url';
      setImportMethod(method);
      onImportMethodChange?.(method);
    },
    [onImportMethodChange]
  );

  const handleUrlInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextUrl = event.target.value;
      setUrlInput(nextUrl);
      onUrlChange?.(nextUrl);
    },
    [onUrlChange]
  );

  const handleDelimiterChange = useCallback(
    (event: SelectChangeEvent<string>) => {
      updateProcessingConfig((prev) => ({
        ...prev,
        delimiter: event.target.value as TabularProcessingConfig['delimiter'],
      }));
    },
    [updateProcessingConfig]
  );

  const handleEncodingChange = useCallback(
    (event: SelectChangeEvent<string>) => {
      updateProcessingConfig((prev) => ({
        ...prev,
        encoding: event.target.value as TabularProcessingConfig['encoding'],
      }));
    },
    [updateProcessingConfig]
  );

  const handleQuoteCharChange = useCallback(
    (event: SelectChangeEvent<string>) => {
      updateProcessingConfig((prev) => ({
        ...prev,
        quoteChar: event.target.value as TabularProcessingConfig['quoteChar'],
      }));
    },
    [updateProcessingConfig]
  );

  const handleHasHeaderChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const checked = event.target.checked;
      updateProcessingConfig((prev) => ({ ...prev, hasHeader: checked }));
    },
    [updateProcessingConfig]
  );

  const handleSkipEmptyLinesChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const checked = event.target.checked;
      updateProcessingConfig((prev) => ({ ...prev, skipEmptyLines: checked }));
    },
    [updateProcessingConfig]
  );

  return {
    fileInputRef,
    urlInput,
    importMethod,
    processingConfig,
    isImporting,
    imortError,
    dragActive,
    dragError,
    modalRoot,
    showDownloadSuccess,
    importMethodLabelId,
    delimiterLabelId,
    encodingLabelId,
    quoteLabelId,
    urlFieldId,
    importMethodSelectId,
    delimiterSelectId,
    encodingSelectId,
    quoteSelectId,
    hasHeaderSwitchId,
    skipEmptyLinesSwitchId,
    handleFileSelect,
    handleUrlDownload,
    handleImportClick,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop,
    handleImportMethodChange,
    handleUrlInputChange,
    handleDelimiterChange,
    handleEncodingChange,
    handleQuoteCharChange,
    handleHasHeaderChange,
    handleSkipEmptyLinesChange,
  };
};
