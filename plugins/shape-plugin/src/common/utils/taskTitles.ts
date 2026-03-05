type StageLike = {
  title?: string | null;
  stage?: string;
  inputData?: unknown;
  metadata?: unknown;
};

type ResolveTaskTitleOptions = {
  resolveCountryNameByCode?: (code: string) => string | undefined;
};

const readString = (value: unknown): string | null => (
  typeof value === 'string' && value.trim().length > 0 ? value : null
);

const readNumber = (value: unknown): number | null => (
  typeof value === 'number' && Number.isFinite(value) ? value : null
);

const readCode = (value: unknown): string | null => {
  const text = readString(value);
  if (!text) return null;
  return text.trim().toUpperCase();
};

const readCountryName = (value: unknown): string | null => {
  const text = readString(value);
  if (!text) return null;
  return text.trim();
};

const equalsCodeToken = (name: string | null, code: string | null): boolean => (
  typeof name === 'string'
  && typeof code === 'string'
  && name.trim().toUpperCase() === code.trim().toUpperCase()
);

const resolveCountryNameWithCode = (
  input: Record<string, unknown>,
  options?: ResolveTaskTitleOptions,
): { countryName: string | null; countryCode: string | null } => {
  const countryCode = readCode(input.admin0Code)
    ?? readCode(input.countryCode)
    ?? readCode(input.urlCountryCode);
  const rawName = readCountryName(input.admin0Name)
    ?? readCountryName(input.countryName)
    ?? readCountryName(input.sourceCountryName);
  const shouldResolveFromCode = !rawName || equalsCodeToken(rawName, countryCode);
  if (!shouldResolveFromCode || !countryCode || !options?.resolveCountryNameByCode) {
    return { countryName: rawName, countryCode };
  }
  const resolvedName = readCountryName(options.resolveCountryNameByCode(countryCode));
  return {
    countryName: resolvedName ?? rawName ?? countryCode,
    countryCode,
  };
};

const resolveStageKey = (task: StageLike): string | undefined => {
  const stage = readString(task.stage)?.trim().toLowerCase();
  if (!stage) return undefined;
  if (stage === 'source' || stage.includes('source')) return 'source';
  if (stage === 'geometry' || stage.includes('geometry')) return 'geometry';
  if (stage === 'tileemit' || stage === 'tile-emit' || stage.includes('tile')) return 'tileEmit';
  return task.stage;
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

const buildInputFromPreview = (metadata: unknown): Record<string, unknown> | undefined => {
  if (!isRecord(metadata)) return undefined;
  const preview = isRecord(metadata.preview) ? metadata.preview : undefined;
  if (!preview) return undefined;
  const candidate: Record<string, unknown> = {};
  if (typeof preview.sourceCountryName === 'string') {
    candidate.countryName = preview.sourceCountryName;
    candidate.admin0Name = preview.sourceCountryName;
  }
  if (typeof preview.sourceCountryCode === 'string') {
    candidate.countryCode = preview.sourceCountryCode;
    candidate.urlCountryCode = preview.sourceCountryCode;
    candidate.admin0Code = preview.sourceCountryCode;
  }
  if (typeof preview.adminLevel === 'number' && Number.isFinite(preview.adminLevel)) {
    candidate.adminLevel = preview.adminLevel;
  }
  if (typeof preview.bandIndex === 'number' && Number.isFinite(preview.bandIndex)) {
    candidate.bandIndex = preview.bandIndex;
  }
  if (typeof preview.bandMinZoom === 'number' && Number.isFinite(preview.bandMinZoom)) {
    candidate.bandMinZoom = preview.bandMinZoom;
  }
  if (typeof preview.bandMaxZoom === 'number' && Number.isFinite(preview.bandMaxZoom)) {
    candidate.bandMaxZoom = preview.bandMaxZoom;
  }
  if (typeof preview.zMin === 'number' && Number.isFinite(preview.zMin)) {
    candidate.zMin = preview.zMin;
  }
  if (typeof preview.zMax === 'number' && Number.isFinite(preview.zMax)) {
    candidate.zMax = preview.zMax;
  }
  return Object.keys(candidate).length > 0 ? candidate : undefined;
};

const buildSourceTitle = (
  input: Record<string, unknown>,
  options?: ResolveTaskTitleOptions,
): string | undefined => {
  const { countryName: admin0Name, countryCode: admin0Code } = resolveCountryNameWithCode(input, options);
  const adminLevel = readNumber(input.adminLevel);
  if (admin0Name && admin0Code && adminLevel !== null && !equalsCodeToken(admin0Name, admin0Code)) {
    return `${admin0Name} (${admin0Code}) Admin${Math.floor(adminLevel)}`;
  }
  if (admin0Name && adminLevel !== null) {
    return `${admin0Name} Admin${Math.floor(adminLevel)}`;
  }
  const adminLevelLabel = adminLevel !== null ? `Admin${Math.floor(adminLevel)}` : undefined;
  const title = [admin0Name, admin0Code ? `(${admin0Code})` : undefined, adminLevelLabel].filter(Boolean).join(' ');
  return title.length > 0 ? title : undefined;
};

const buildGeometryTitle = (
  input: Record<string, unknown>,
  options?: ResolveTaskTitleOptions,
): string | undefined => {
  const { countryName: admin0Name, countryCode: admin0Code } = resolveCountryNameWithCode(input, options);
  const countryLabel = admin0Name && admin0Code && !equalsCodeToken(admin0Name, admin0Code)
    ? `${admin0Name} (${admin0Code})`
    : admin0Name ?? (admin0Code ? `(${admin0Code})` : undefined);
  const adminLevel = readNumber(input.adminLevel);
  const adminLabel = adminLevel !== null ? `Admin${Math.floor(adminLevel)}` : undefined;
  const bandIndex = readNumber(input.bandIndex);
  const bandLabel = bandIndex !== null ? `band ${Math.floor(bandIndex)}` : undefined;
  const bandMinZoom = readNumber(input.bandMinZoom)
    ?? readNumber(input.zMin)
    ?? readNumber(input.minZoom);
  const bandMaxZoom = readNumber(input.bandMaxZoom)
    ?? readNumber(input.zMax)
    ?? readNumber(input.maxZoom);
  if (bandMinZoom === null || bandMaxZoom === null) {
    throw new Error('[shape-plugin] geometry task title requires bandMinZoom and bandMaxZoom');
  }
  const zoomBandLabel = `z${Math.floor(bandMinZoom)}-${Math.floor(bandMaxZoom)}`;
  const left = [countryLabel, adminLabel].filter(Boolean).join(' ');
  const right = [bandLabel, zoomBandLabel].filter(Boolean).join(' ');
  const title = [left || undefined, right || undefined].filter(Boolean).join(' / ');
  return title.length > 0 ? title : undefined;
};

const buildTileEmitTitle = (input: Record<string, unknown>): string | undefined => {
  const TILE_INDEX_BITS = 22;
  const TILE_INDEX_SCALE = 2 ** TILE_INDEX_BITS;
  const TILE_INDEX_STRIDE = TILE_INDEX_SCALE * TILE_INDEX_SCALE;
  const bandIndex = readNumber(input.bandIndex);
  const zBase = readNumber(input.zBase);
  const tileId = readNumber(input.tileId);
  const bandLabel = bandIndex !== null ? `band${bandIndex}` : undefined;
  const unpackTileId = (tileIdValue: number, zBaseValue: number): { x: number; y: number } | null => {
    const offset = tileIdValue - (zBaseValue * TILE_INDEX_STRIDE);
    if (!Number.isFinite(offset)) return null;
    const x = Math.floor(offset / TILE_INDEX_SCALE);
    const y = offset - (x * TILE_INDEX_SCALE);
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0) return null;
    return { x, y };
  };
  const coords = zBase !== null && tileId !== null
    ? unpackTileId(tileId, zBase)
    : null;
  const zoomLabel = zBase !== null && coords
    ? `z${zBase}/${coords.x}/${coords.y}`
    : undefined;
  const title = [bandLabel, zoomLabel].filter(Boolean).join(' ');
  return title.length > 0 ? title : undefined;
};

export const buildShapeTaskTitle = (
  task: StageLike,
  options?: ResolveTaskTitleOptions,
): string | undefined => {
  const stage = resolveStageKey(task);
  const existing = readString(task.title);
  if (existing && stage !== 'geometry') return existing;
  const input = isRecord(task.inputData)
    ? task.inputData
    : buildInputFromPreview(task.metadata);
  if (stage === 'geometry' && !input) {
    throw new Error('[shape-plugin] geometry task title requires inputData or metadata.preview');
  }
  if (!input) return undefined;
  if (stage === 'source') return buildSourceTitle(input, options);
  if (stage === 'geometry') return buildGeometryTitle(input, options);
  if (stage === 'tileEmit') return buildTileEmitTitle(input);
  return undefined;
};

export const resolveShapeTaskTitle = (
  task: StageLike,
  fallback = '',
  options?: ResolveTaskTitleOptions,
): string => {
  const title = buildShapeTaskTitle(task, options);
  if (title) return title;
  return fallback;
};
