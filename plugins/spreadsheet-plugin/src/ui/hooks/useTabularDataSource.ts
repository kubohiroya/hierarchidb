import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { PluginStepProps } from '@hierarchidb/plugin-base';
import type {
  TabularDataImportProps,
  TabularProcessingConfig,
} from '@hierarchidb/ui-tabular';
import type { TabularTableMetadata } from '@hierarchidb/tabular-store';
import type { SpreadsheetDraft, SpreadSheetDataSourceType } from '~/common/types/SpreadsheetEntity';
import { SPREADSHEET_NODE_TYPE } from '~/common/constants';
import { createSpreadsheetTabularApi } from '~/services/spreadsheetTabularApiFactory';

const coerceDialogData = (value: unknown): SpreadsheetDraft =>
  (typeof value === 'object' && value !== null ? (value as SpreadsheetDraft) : {});

type ImportMethod = 'file' | 'url';

export type UseTabularDataSourceParams = Pick<
  PluginStepProps<SpreadsheetDraft>,
  'data' | 'onChange' | 'setValid' | 'setError' | 'nodeId'
> & { dialogRef?: RefObject<HTMLElement | null>; missingDatasetMessage?: string };

type ExtendedImportProps = TabularDataImportProps & {
  initialProcessingConfig?: TabularProcessingConfig;
  onProcessingConfigChange?: (config: TabularProcessingConfig) => void;
};

export interface UseTabularDataSourceResult {
  dialogData: SpreadsheetDraft;
  tabularApi: ReturnType<typeof createSpreadsheetTabularApi>;
  menuContainer: Element | null;
  importAccordion: {
    expanded: boolean;
    onChange: (_: unknown, expanded: boolean) => void;
  };
  detailsAccordion: {
    expanded: boolean;
    onChange: (_: unknown, expanded: boolean) => void;
  };
  hasMetadata: boolean;
  importStepProps: ExtendedImportProps;
  formatBytes: (value?: number | null) => string;
  details: {
    filename: string;
    sizeBytes?: number;
    contentHash?: string;
    createdAt?: number | null;
  };
}

const formatBytes = (value?: number | null): string => {
  const bytes = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
};

const decodeSafe = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const parseCorsProxyUrl = (source: string): string | null => {
  try {
    const parsed = new URL(source, 'http://localhost');
    const proxied = parsed.searchParams.get('url');
    if (!proxied) return null;
    return decodeSafe(proxied);
  } catch {
    return null;
  }
};

const isLooksLikeUrl = (source?: string): boolean => {
  if (!source) return false;
  if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(source) || source.startsWith('//')) {
    return true;
  }
  return parseCorsProxyUrl(source) !== null;
};

const normalizeImportUrl = (source?: string): string => {
  if (!source) return '';
  const candidate = source.trim();
  const decodedProxy = parseCorsProxyUrl(candidate);
  if (decodedProxy && isLooksLikeUrl(decodedProxy)) {
    return decodedProxy;
  }
  return candidate;
};

const resolveImportMethod = (
  type: SpreadSheetDataSourceType['type'] | undefined,
  source?: string,
): ImportMethod => {
  if (type === 'url') return 'url';
  if (type === 'file') return 'file';
  return isLooksLikeUrl(source) ? 'url' : 'file';
};

const clearUrlDownloadState = (
  dialogData: SpreadsheetDraft,
  source?: string,
): Pick<
  SpreadsheetDraft,
  'spreadsheetMetadataId' | 'dataSource' | 'tabularTableMetadata' | 'file'
> => ({
  spreadsheetMetadataId: undefined,
  tabularTableMetadata: undefined,
  file: undefined,
  dataSource: {
    ...(dialogData.dataSource ?? { type: 'url' }),
    ...(source === undefined ? {} : { source }),
    type: 'url',
    filename: undefined,
    sizeBytes: undefined,
    contentHash: undefined,
  },
});

export const useTabularDataSource = ({
  data,
  onChange,
  setValid,
  setError,
  nodeId,
  dialogRef,
  missingDatasetMessage = 'select or download a data file before continuing.',
}: UseTabularDataSourceParams): UseTabularDataSourceResult => {
  const dialogData = useMemo<SpreadsheetDraft>(() => coerceDialogData(data), [data]);

  const tabularApi = useMemo(() => createSpreadsheetTabularApi(SPREADSHEET_NODE_TYPE), []);
  const derivedImportMethod = resolveImportMethod(dialogData.dataSource?.type, dialogData.dataSource?.source);
  const derivedUrl = normalizeImportUrl(dialogData.dataSource?.source);
  const derivedProcessing = dialogData.tabularProcessingConfig;
  const importMethodRef = useRef<ImportMethod>(derivedImportMethod);
  const downloadUrlRef = useRef(derivedUrl);
  const urlImportPendingRef = useRef(derivedImportMethod === 'url');
  const autoStartDownload = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const { search, hash } = window.location;
    const hashQueryIndex = hash.indexOf('?');
    const hashQuery = hashQueryIndex >= 0 ? hash.slice(hashQueryIndex + 1) : '';
    const params = new URLSearchParams(search || hashQuery);
    return params.get('build') === '1';
  }, []);

  const [downloadUrl, setDownloadUrl] = useState(derivedUrl);
  const [lastSuccessfulUrl, setLastSuccessfulUrl] = useState<string | null>(() => {
    const source = dialogData.dataSource?.source ?? undefined;
    const hasMetadata = Boolean(dialogData.spreadsheetMetadataId && source);
    const sourceLooksLikeUrl = isLooksLikeUrl(source);
    const persistedAsUrl = dialogData.dataSource?.type === 'url' || derivedImportMethod === 'url';
    return hasMetadata && (persistedAsUrl || sourceLooksLikeUrl) ? normalizeImportUrl(source) : null;
  });
  const [processingConfig, setProcessingConfig] = useState<TabularProcessingConfig | undefined>(derivedProcessing);
  const importSucceeded = Boolean(lastSuccessfulUrl && lastSuccessfulUrl === downloadUrl);
  const hasMetadata = Boolean(dialogData.spreadsheetMetadataId);
  const [importExpanded, setImportExpanded] = useState<boolean>(() => !hasMetadata);
  const [detailsExpanded, setDetailsExpanded] = useState<boolean>(() => hasMetadata);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    importMethodRef.current = derivedImportMethod;
    urlImportPendingRef.current = derivedImportMethod === 'url';
  }, [derivedImportMethod]);

  useEffect(() => {
    downloadUrlRef.current = derivedUrl;
    setDownloadUrl(derivedUrl);
  }, [derivedUrl]);

  useEffect(() => {
    if (derivedProcessing) {
      setProcessingConfig(derivedProcessing);
    }
  }, [derivedProcessing]);

  const menuContainer = useMemo(() => {
    const dialogEl = dialogRef?.current;
    if (dialogEl instanceof HTMLElement) {
      return dialogEl.closest('.MuiModal-root') ?? dialogEl;
    }
    return null;
  }, [dialogRef]);

  const onFileImported = useCallback(
    (tabularTableMetadata: TabularTableMetadata) => {
      const isUrlImport = urlImportPendingRef.current || importMethodRef.current === 'url';
      const normalizedDownloadUrl = normalizeImportUrl(downloadUrlRef.current);
      const nextSource = isUrlImport
        ? (normalizedDownloadUrl || tabularTableMetadata.fileUrl) ?? tabularTableMetadata.filename
        : tabularTableMetadata.fileUrl ?? tabularTableMetadata.filename;
      const nextType: ImportMethod = isUrlImport ? 'url' : 'file';
      const nextDataSource: SpreadSheetDataSourceType = {
        type: nextType,
        source: nextSource,
        filename: tabularTableMetadata.filename,
        sizeBytes: tabularTableMetadata.fileSizeBytes ?? 0,
        contentHash: tabularTableMetadata.contentHash,
      };
      onChange({
        ...dialogData,
        spreadsheetMetadataId: tabularTableMetadata.id,
        dataSource: nextDataSource,
        tabularTableMetadata,
        file: {
          name: tabularTableMetadata.filename,
          sizeBytes: tabularTableMetadata.fileSizeBytes ?? 0,
          lastModifiedAt: Date.now(),
        },
        tabularProcessingConfig: processingConfig,
      });
      if (nextType === 'url' && normalizedDownloadUrl) {
        setLastSuccessfulUrl(normalizedDownloadUrl);
      }
      urlImportPendingRef.current = false;
      setImportExpanded(false);
      setDetailsExpanded(true);
      setLocalError(null);
      setValid(true);
      setError(null);
    },
    [dialogData, onChange, processingConfig, setError, setValid],
  );

  const handleImportError = useCallback(
    (message: string) => {
      setLocalError(message);
      setValid(false);
      setError(message);
    },
    [setError, setValid],
  );

  useEffect(() => {
    setValid(hasMetadata);
    if (!hasMetadata && !localError) {
      setError(missingDatasetMessage);
    } else if (hasMetadata) {
      setError(null);
    }
  }, [hasMetadata, localError, missingDatasetMessage, setError, setValid]);

  const prevHasMetadataRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (prevHasMetadataRef.current === hasMetadata) return;
    setImportExpanded(!hasMetadata);
    setDetailsExpanded(hasMetadata);
    prevHasMetadataRef.current = hasMetadata;
  }, [hasMetadata]);

  useEffect(() => {
    const needsBackfill = dialogData.tabularProcessingConfig === undefined;
    if (!needsBackfill) return;
    onChange({
      ...dialogData,
      tabularProcessingConfig:
        processingConfig ?? {
          delimiter: ',',
          encoding: 'utf-8',
          hasHeader: true,
          quoteChar: '"',
          escapeChar: '\\',
          skipEmptyLines: true,
        },
    });
  }, [dialogData, onChange, processingConfig]);

  const importStepProps: ExtendedImportProps = {
    pluginId: SPREADSHEET_NODE_TYPE,
    nodeId,
    onFileImported,
    onError: handleImportError,
    menuContainer,
    initialImportMethod: derivedImportMethod,
    initialUrl: downloadUrl,
    initialProcessingConfig: processingConfig,
    onImportMethodChange: (method: ImportMethod) => {
      importMethodRef.current = method;
      urlImportPendingRef.current = method === 'url';
      if (method === 'url') {
        const nextSource = isLooksLikeUrl(dialogData.dataSource?.source)
          ? dialogData.dataSource?.source
          : undefined;
        onChange({
          ...dialogData,
          ...clearUrlDownloadState(dialogData, nextSource),
        });
        setLastSuccessfulUrl(null);
        return;
      }

      onChange({
        ...dialogData,
        dataSource: {
          ...(dialogData.dataSource ?? { type: method }),
          type: method,
        },
      });
    },
    onUrlChange: (url: string) => {
      setDownloadUrl(url);
      downloadUrlRef.current = url;
      urlImportPendingRef.current = true;
      if (lastSuccessfulUrl && url !== lastSuccessfulUrl) {
        setLastSuccessfulUrl(null);
      }
      const nextState = clearUrlDownloadState(dialogData, url);
      onChange({
        ...dialogData,
        ...nextState,
        dataSource: {
          ...nextState.dataSource,
          source: url,
          type: 'url',
        },
      });
    },
    onProcessingConfigChange: (cfg: TabularProcessingConfig) => {
      setProcessingConfig(cfg);
      onChange({ ...dialogData, tabularProcessingConfig: cfg });
    },
    importSucceeded,
    autoStartDownload,
  };

  return {
    dialogData,
    tabularApi,
    menuContainer,
    importAccordion: {
      expanded: importExpanded,
      onChange: (_, expanded) => setImportExpanded(expanded),
    },
    detailsAccordion: {
      expanded: detailsExpanded,
      onChange: (_, expanded) => setDetailsExpanded(expanded),
    },
    hasMetadata,
    importStepProps,
    formatBytes,
    details: {
      filename: dialogData.dataSource?.filename ?? dialogData.tabularTableMetadata?.filename ?? '—',
      sizeBytes: dialogData.dataSource?.sizeBytes ?? dialogData.tabularTableMetadata?.fileSizeBytes,
      contentHash: dialogData.dataSource?.contentHash ?? dialogData.tabularTableMetadata?.contentHash,
      createdAt: dialogData.tabularTableMetadata?.createdAt ?? null,
    },
  };
};
