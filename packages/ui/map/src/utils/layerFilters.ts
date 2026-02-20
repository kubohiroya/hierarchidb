import type { MapLibreFilter } from '~/types/maplibre-public';

const buildPropertyExpression = (keys: string[]) =>
  keys.length === 1 ? ['get', keys[0]] : ['coalesce', ...keys.map((key) => ['get', key])];

export const buildCategoryFilter = (
  enabledValues: string[],
  knownValues: string[],
  propertyKeys: string[],
): MapLibreFilter | null => {
  if (enabledValues.length === 0) return null;
  if (enabledValues.length === knownValues.length) return null;
  const propertyExpr = buildPropertyExpression(propertyKeys);
  return [
    'any',
    ['!', ['in', propertyExpr, ['literal', knownValues]]],
    ['in', propertyExpr, ['literal', enabledValues]],
  ] as MapLibreFilter;
};

export const mergeFilters = (base?: MapLibreFilter, next?: MapLibreFilter | null): MapLibreFilter | undefined => {
  if (!base) return next ?? undefined;
  if (!next) return base;
  return ['all', base, next] as MapLibreFilter;
};
