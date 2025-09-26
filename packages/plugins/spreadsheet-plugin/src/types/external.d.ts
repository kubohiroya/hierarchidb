declare module 'react' {
  export type ReactNode = any;
  export type FC<P = {}> = (props: P) => ReactNode | null;
  export interface RefObject<T> { current: T | null; }
  export interface ChangeEvent<T = any> {
    target: {
      value: string;
      files?: FileList | null;
    } & T;
  }
  export interface DragEvent<T = any> {
    dataTransfer: DataTransfer;
    preventDefault: () => void;
    stopPropagation: () => void;
    currentTarget: T;
  }
  export interface MouseEvent<T = any> {
    preventDefault: () => void;
    stopPropagation: () => void;
    currentTarget: T;
  }
  export interface KeyboardEvent<T = any> {
    key: string;
    preventDefault: () => void;
    stopPropagation: () => void;
    currentTarget: T;
  }
  export interface SyntheticEvent<T = any> {
    preventDefault: () => void;
    stopPropagation: () => void;
    currentTarget: T;
  }
  export function useState<S = undefined>(initialState?: S | (() => S)): [S, (value: S) => void];
  export function useEffect(effect: () => void | (() => void), deps?: unknown[]): void;
  export function useMemo<T>(factory: () => T, deps: unknown[]): T;
  export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: unknown[]): T;
  export function useRef<T>(initialValue: T | null): RefObject<T>;
  export const Fragment: unique symbol;
  const React: {
    useState: typeof useState;
    useEffect: typeof useEffect;
    useMemo: typeof useMemo;
    useCallback: typeof useCallback;
    useRef: typeof useRef;
    Fragment: typeof Fragment;
  };
  export default React;
}

declare namespace React {
  type ReactNode = any;
  type FC<P = {}> = (props: P) => ReactNode | null;
  interface RefObject<T> { current: T | null; }
  interface ChangeEvent<T = any> {
    target: {
      value: string;
      files?: FileList | null;
    } & T;
  }
  interface DragEvent<T = any> {
    dataTransfer: DataTransfer;
    preventDefault: () => void;
    stopPropagation: () => void;
    currentTarget: T;
  }
  interface MouseEvent<T = any> {
    preventDefault: () => void;
    stopPropagation: () => void;
    currentTarget: T;
  }
  interface KeyboardEvent<T = any> {
    key: string;
    preventDefault: () => void;
    stopPropagation: () => void;
    currentTarget: T;
  }
  interface SyntheticEvent<T = any> {
    preventDefault: () => void;
    stopPropagation: () => void;
    currentTarget: T;
  }
}

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}

declare module 'react/jsx-runtime' {
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}

declare module 'react-i18next' {
  export interface UseTranslationResult {
    t: (key: string, defaultValue?: string) => string;
  }
  export function useTranslation(namespace?: string | string[]): UseTranslationResult;
}

declare module '@mui/material' {
  export const Alert: any;
  export const Box: any;
  export const Button: any;
  export const Card: any;
  export const CardContent: any;
  export const Chip: any;
  export const CircularProgress: any;
  export const FormControl: any;
  export const FormControlLabel: any;
  export const InputLabel: any;
  export const MenuItem: any;
  export const Divider: any;
  export const Select: any;
  export const Switch: any;
  export const LinearProgress: any;
  export const Paper: any;
  export const Stack: any;
  export const Tab: any;
  export const Tabs: any;
  export const TextField: any;
  export const Typography: any;
  export const alpha: any;
  export const useTheme: () => any;
}

declare module '@mui/icons-material' {
  export const Login: any;
  export const InsertDriveFile: any;
}

declare module '@mui/icons-material/*' {
  const IconComponent: any;
  export default IconComponent;
}

declare module '@hierarchidb/runtime-ui-plugin-dialog' {
  import type { ReactNode } from 'react';

  export interface StepComponentProps {
    mode: 'create' | 'edit';
    nodeId?: string;
    parentId?: string;
    data: any;
    onChange: (data: any) => void;
    setValid: (valid: boolean) => void;
    setError: (error: string | null) => void;
  }

  export interface PluginStepCapabilities {
    canProceedToNext?: (data?: unknown) => boolean;
  }

  export interface PluginStepConfig {
    id: string;
    label?: string;
    componentFactory?: (props: StepComponentProps) => ReactNode;
    validate?: (data?: unknown) => boolean;
    optional?: boolean;
    capabilities?: PluginStepCapabilities;
  }

  export interface PluginStepConfigProvider {
    nodeType: string;
    getCreateStepConfigs(): PluginStepConfig[];
    getEditStepConfigs(nodeId: string, data?: unknown): PluginStepConfig[];
  }

  export class PluginStepRegistry {
    static getInstance(): PluginStepRegistry;
    registerConfigProvider(provider: PluginStepConfigProvider): void;
  }
}

declare module '@hierarchidb/ui-csv-extract' {
  export type CSVColumnType = string;
  export interface CSVProcessingConfig {
    delimiter?: string;
    hasHeader?: boolean;
    encoding?: string;
    quoteChar?: string;
    escapeChar?: string;
    skipEmptyLines?: boolean;
    [key: string]: unknown;
  }
  export interface CSVColumnMetadata {
    name: string;
    type?: CSVColumnType;
    [key: string]: unknown;
  }
  export interface CSVTableMetadata {
    id: string;
    filename?: string;
    fileUrl?: string;
    totalRows?: number;
    columns?: CSVColumnMetadata[];
    contentHash?: string;
    fileSizeBytes?: number;
    createdAt?: number;
    updatedAt?: number;
    referenceCount?: number;
    referencingPlugins?: string[];
    isChunked?: boolean;
    chunkCount?: number;
    [key: string]: unknown;
  }
  export interface CSVFilterRule {
    field?: string;
    operator: string;
    value?: unknown;
    column?: string;
    id?: string;
    enabled?: boolean;
    [key: string]: unknown;
  }
  export interface CSVSelectionConfig {
    columns?: string[];
    limit?: number;
    filterRules?: CSVFilterRule[];
    [key: string]: unknown;
  }
  export interface CSVDataResult {
    rows: unknown[];
    columns?: CSVColumnMetadata[];
    [key: string]: unknown;
  }
  export interface CSVTableListResult {
    tables: CSVTableMetadata[];
    total?: number;
  }
  export interface PaginationOptions {
    limit: number;
    offset: number;
  }
  export interface CSVProcessingStatus {
    status: string;
    [key: string]: unknown;
  }
  export interface CSVColumnInfo extends CSVColumnMetadata {
    sampleValues?: unknown[];
    index?: number;
  }
  export interface ICSVDataApi {
    uploadCSVFile(file: File, config?: CSVProcessingConfig): Promise<CSVTableMetadata>;
    downloadCSVFromUrl(url: string, config?: CSVProcessingConfig): Promise<CSVTableMetadata>;
    getFilteredPreview(tableId: string, filters: CSVFilterRule[], rowCount: number): Promise<CSVDataResult>;
    getFilteredData(tableId: string, selection: CSVSelectionConfig): Promise<CSVDataResult>;
    getTableMetadata(id: string): Promise<CSVTableMetadata | null>;
    listTables(pluginId?: string, pagination?: PaginationOptions): Promise<CSVTableListResult>;
    deleteTable(tableMetadataId: string): Promise<void>;
    addTableReference(tableId: string, pluginId: string): Promise<void>;
    removeTableReference(tableId: string, pluginId: string): Promise<void>;
    getProcessingStatus?: (id: string) => Promise<CSVProcessingStatus | null>;
  }
}

declare module '@hierarchidb/ui-file' {
  import type { FC, ReactNode } from 'react';

  export interface FileInputWithUrlProps {
    onFileSelect: (file: File, downloadUrl?: string) => void | Promise<void>;
    accept?: string;
    buttonLabel?: string;
    loading?: boolean;
    error?: string | null;
    showUrlDownload?: boolean;
    instructions?: ReactNode;
    disabled?: boolean;
    sx?: object;
    onUrlDownload?: (url: string) => Promise<void>;
    layout?: 'vertical' | 'horizontal';
  }

  export const FileInputWithUrl: FC<FileInputWithUrlProps>;
}

declare module '../ui/facade/index.js' {
  import type { ICSVDataApi } from '@hierarchidb/ui-csv-extract';
  export function createSpreadsheetCSVApi(pluginId?: string): ICSVDataApi;
}

declare module '@hierarchidb/table-metadata' {
  export type MetadataId = string;

  export interface MetadataInput {
    id: MetadataId;
    filename?: string;
    fileUrl?: string;
    contentHash?: string;
    fileSizeBytes?: number;
    createdAt?: number;
    updatedAt?: number;
    referenceCount?: number;
    referencingPlugins?: string[];
    isChunked?: boolean;
    chunkCount?: number;
    columns?: { name: string; type?: string; sampleValues?: unknown[] }[];
    [key: string]: unknown;
  }

  export interface TableMetadata extends MetadataInput {}

  export class SimpleTableMetadataManager {
    constructor(dbName?: string);
    create(metadata: MetadataInput, pluginId: string): Promise<TableMetadata>;
    get(id: MetadataId): Promise<TableMetadata | null>;
    list(): Promise<TableMetadata[]>;
    addReference(id: MetadataId, pluginId: string): Promise<void>;
    removeReference(id: MetadataId, pluginId: string): Promise<void>;
    forceDelete?(id: MetadataId): Promise<void>;
  }
}
