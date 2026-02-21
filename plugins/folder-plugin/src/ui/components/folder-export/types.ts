export type FolderExportMode = 'continuity' | 'distribution';

export type FolderExportScope = 'shapeOnly' | 'all';

export type FolderExportFormat = 'json' | 'pbf.zip' | 'mvf';

export interface FolderExportDraftData {
  exportMode: FolderExportMode;
  targetScope: FolderExportScope;
  format: FolderExportFormat;
  minZoom: number;
  maxZoom: number;
  maxTileBytes: number;
  downloadPayload: boolean;
}

export const createDefaultFolderExportDraft = (): FolderExportDraftData => ({
  exportMode: 'continuity',
  targetScope: 'all',
  format: 'json',
  minZoom: 0,
  maxZoom: 10,
  maxTileBytes: 1_048_576,
  downloadPayload: false,
});

export const normalizeFolderExportDraft = (
  data: FolderExportDraftData | undefined,
): FolderExportDraftData => {
  const defaults = createDefaultFolderExportDraft();
  const draft: FolderExportDraftData = {
    ...defaults,
    ...(data ?? {}),
  };
  const exportMode: FolderExportMode = draft.exportMode === 'distribution' ? 'distribution' : 'continuity';
  const targetScope: FolderExportScope = draft.targetScope === 'shapeOnly' ? 'shapeOnly' : 'all';
  const format =
    draft.format === 'pbf.zip' || draft.format === 'mvf' || draft.format === 'json'
      ? draft.format
      : exportMode === 'continuity'
        ? 'json'
        : 'pbf.zip';

  return {
    ...draft,
    exportMode,
    targetScope,
    format,
  };
};
