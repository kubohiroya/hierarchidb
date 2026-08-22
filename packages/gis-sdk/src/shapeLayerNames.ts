export type BrandedString<T extends string, TBrand extends string> = T & {
  readonly __brand: TBrand;
};

export type ShapeLayerBoundarySymbol = BrandedString<'b' | 'f', 'ShapeLayerBoundarySymbol'>;
export type ShapeSourceLayerName = BrandedString<string, 'ShapeSourceLayerName'>;

export type LayerNameBoundaryMode = 'fill' | 'boundary';

const SHAPE_SOURCE_LAYER_RE = /^(0|[1-9][0-9]*)(?:-(b))?$/;

const normalizeLayerName = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.toLowerCase();
};

const toBoundarySymbol = (mode: LayerNameBoundaryMode): ShapeLayerBoundarySymbol =>
  (mode === 'boundary' ? 'b' : 'f') as ShapeLayerBoundarySymbol;

export const buildShapeSourceLayerName = (
  adminLevel: number,
  boundaryMode: LayerNameBoundaryMode = 'fill'
): ShapeSourceLayerName =>
  `${adminLevel}${boundaryMode === 'boundary' ? '-b' : ''}` as ShapeSourceLayerName;

export const parseShapeSourceLayerName = (
  value: unknown
):
  | {
      adminLevel: number;
      boundary: ShapeLayerBoundarySymbol;
    }
  | undefined => {
  const normalized = normalizeLayerName(value);
  if (!normalized) return undefined;

  const match = SHAPE_SOURCE_LAYER_RE.exec(normalized);
  if (!match) return undefined;

  const adminLevel = Number(match[1]);
  if (!Number.isInteger(adminLevel) || adminLevel < 0) return undefined;
  const boundaryMode: LayerNameBoundaryMode =
    (match[2] ?? '').toLowerCase() === 'b' ? 'boundary' : 'fill';
  return {
    adminLevel,
    boundary: toBoundarySymbol(boundaryMode),
  };
};
