import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { PluginStepProps } from '@hierarchidb/plugin-base';
import type {
  TabularDataImportProps,
  TabularProcessingConfig,
} from '@hierarchidb/ui-tabular';
import type { TabularTableMetadata } from '@hierarchidb/tabular-store';
import type { SpreadsheetEntity, SpreadSheetDataSourceType } from '../../common/types/SpreadsheetEntity.js';
import { SPREADSHEET_NODE_TYPE } from '../../common/constants.js';
import { createSpreadsheetTabularApi } from '../../services/spreadsheetTabularApiFactory.js';

const coerceDialogData = (value: unknown): SpreadsheetEntity =>
  (typeof value === 'object' && value !== null ? (value as SpreadsheetEntity) : {});

type ImportMethod = 'file' | 'url';

export type UseTabularDataSourceParams = Pick<
  PluginStepProps<SpreadsheetEntity>,
  'data' | 'onChange' | 'setValid' | 'setError' | 'nodeId'
> & { dialogRef?: RefObject<HTMLElement | null>; missingDatasetMessage?: string };

type ExtendedImportProps = TabularDataImportProps & {
  initialProcessingConfig?: TabularProcessingConfig;
  onProcessingConfigChange?: (config: TabularProcessingConfig) => void;
};

export interface UseTabularDataSourceResult {
  dialogData: SpreadsheetEntity;
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

export const useTabularDataSource = ({
  data,
  onChange,
  setValid,
  setError,
  nodeId,
  dialogRef,
  missingDatasetMessage = 'select or download a data file before continuing.',
}: UseTabularDataSourceParams): UseTabularDataSourceResult => {
  const dialogData = useMemo<SpreadsheetEntity>(() => coerceDialogData(data), [data]);

  const tabularApi = useMemo(() => createSpreadsheetTabularApi(SPREADSHEET_NODE_TYPE), []);
  const derivedImportMethod: ImportMethod =
    dialogData.dataSource?.type === 'url' || dialogData.dataSource?.source?.startsWith('http') ? 'url' : 'file';
  const derivedUrl = dialogData.dataSource?.source ?? '';
  const derivedProcessing = dialogData.tabularProcessingConfig;

  const [importMethod, setImportMethod] = useState<ImportMethod>(derivedImportMethod);
  const [downloadUrl, setDownloadUrl] = useState(derivedUrl);
  const [lastSuccessfulUrl, setLastSuccessfulUrl] = useState<string | null>(() => {
    const source = dialogData.dataSource?.source ?? null;
    const hasMetadata = Boolean(dialogData.spreadsheetMetadataId && source);
    const sourceLooksLikeUrl = source?.startsWith('http');
    const persistedAsUrl = dialogData.dataSource?.type === 'url' || derivedImportMethod === 'url';
    return hasMetadata && (persistedAsUrl || sourceLooksLikeUrl) ? source : null;
  });
  const [processingConfig, setProcessingConfig] = useState<TabularProcessingConfig | undefined>(derivedProcessing);
  const importSucceeded = Boolean(lastSuccessfulUrl && lastSuccessfulUrl === downloadUrl);
  const hasMetadata = Boolean(dialogData.spreadsheetMetadataId);
  const [importExpanded, setImportExpanded] = useState<boolean>(() => !hasMetadata);
  const [detailsExpanded, setDetailsExpanded] = useState<boolean>(() => hasMetadata);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setImportMethod(derivedImportMethod);
  }, [derivedImportMethod]);

  useEffect(() => {
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
      const nextDataSource: SpreadSheetDataSourceType = {
        type: importMethod,
        source: importMethod === 'url' ? downloadUrl : tabularTableMetadata.fileUrl ?? tabularTableMetadata.filename,
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
      if (importMethod === 'url') {
        setLastSuccessfulUrl(downloadUrl);
      }
      setImportExpanded(false);
      setDetailsExpanded(true);
      setLocalError(null);
      setValid(true);
      setError(null);
    },
    [dialogData, downloadUrl, importMethod, onChange, processingConfig, setError, setValid],
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
      setImportMethod(method);
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
      if (lastSuccessfulUrl && url !== lastSuccessfulUrl) {
        setLastSuccessfulUrl(null);
      }
      onChange({
        ...dialogData,
        dataSource: {
          ...(dialogData.dataSource ?? { type: 'url' }),
          type: 'url',
          source: url,
        },
      });
    },
    onProcessingConfigChange: (cfg: TabularProcessingConfig) => {
      setProcessingConfig(cfg);
      onChange({ ...dialogData, tabularProcessingConfig: cfg });
    },
    importSucceeded,
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
