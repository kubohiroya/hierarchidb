type StageLike = {
  title?: string | null;
  stage?: string;
  taskType?: string;
  type?: string;
  inputData?: unknown;
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

const resolveStageKey = (task: StageLike): string | undefined => (
  task.taskType ?? task.type ?? task.stage
);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

const buildFetchTitle = (input: Record<string, unknown>): string | undefined => {
  const admin0Name = readString(input.admin0Name)
    ?? readString(input.countryName)
    ?? readString(input.countryCode)
    ?? readString(input.urlCountryCode);
  const admin0Code = readCode(input.admin0Code)
    ?? readCode(input.countryCode)
    ?? readCode(input.urlCountryCode);
  const adminLevel = readNumber(input.adminLevel);
  if (admin0Name && admin0Code && adminLevel !== null) {
    return `${admin0Name} (${admin0Code}) ${adminLevel}`;
  }
  const adminLevelLabel = adminLevel !== null ? String(adminLevel) : undefined;
  const title = [admin0Name, admin0Code ? `(${admin0Code})` : undefined, adminLevelLabel].filter(Boolean).join(' ');
  return title.length > 0 ? title : undefined;
};

const buildTransformTitle = (input: Record<string, unknown>): string | undefined => {
  const country = readString(input.countryName) ?? readString(input.countryCode);
  const adminLevel = readNumber(input.adminLevel);
  const adminLabel = adminLevel !== null ? `ADM${adminLevel}` : undefined;
  const bandIndex = readNumber(input.bandIndex);
  const bandLabel = bandIndex !== null ? `band${bandIndex}` : undefined;
  const bandMinZoom = readNumber(input.bandMinZoom);
  const bandMaxZoom = readNumber(input.bandMaxZoom);
  const zoomBandLabel = bandMinZoom !== null && bandMaxZoom !== null
    ? `z${bandMinZoom}-z${bandMaxZoom}`
    : undefined;
  const title = [country, adminLabel, bandLabel, zoomBandLabel].filter(Boolean).join(' ');
  return title.length > 0 ? title : undefined;
};

const buildVtTitle = (input: Record<string, unknown>): string | undefined => {
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

export const buildShapeTaskTitle = (task: StageLike): string | undefined => {
  const existing = readString(task.title);
  if (existing) return existing;
  const input = isRecord(task.inputData) ? task.inputData : undefined;
  if (!input) return undefined;
  const stage = resolveStageKey(task);
  if (stage === 'fetch') return buildFetchTitle(input);
  if (stage === 'transform') return buildTransformTitle(input);
  if (stage === 'vt') return buildVtTitle(input);
  return undefined;
};

export const resolveShapeTaskTitle = (task: StageLike, fallback = ''): string => {
  const title = buildShapeTaskTitle(task);
  if (title) return title;
  return fallback;
};
