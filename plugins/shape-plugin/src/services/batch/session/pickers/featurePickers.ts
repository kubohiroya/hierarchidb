export const pickFirstString = (properties: Record<string, unknown>, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = properties[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
};

export const pickAdminName = (properties: Record<string, unknown>): string | undefined =>
  pickFirstString(properties, [
    'adminName',
    'admin_name',
    'ADMIN_NAME',
    'shapeName',
    'NAME_0',
    'NAME_1',
    'NAME_2',
    'NAME_3',
    'NAME_4',
    'NAME_5',
    'name',
  ]);

export const pickCountryCode = (properties: Record<string, unknown>): string | undefined =>
  pickFirstString(properties, ['ISO_A3', 'ISO3', 'ADM0_A3', 'countryCode', 'COUNTRY_CODE']);

export const pickCountryName = (properties: Record<string, unknown>): string | undefined =>
  pickFirstString(properties, ['COUNTRY_NAME', 'COUNTRY', 'NAME_0', 'countryName']);

export const pickAdminCode = (properties: Record<string, unknown>): string | undefined =>
  pickFirstString(properties, ['GID_0', 'GID_1', 'GID_2', 'GID_3', 'shapeID', 'adminCode', 'code']);

export const pickAdminLevel = (properties: Record<string, unknown>): number | undefined => {
  const candidates = [
    properties.adminLevel,
    properties.admin_level,
    properties.ADM_LEVEL,
    properties.level,
  ];
  for (const value of candidates) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
};

export const buildFeatureId = (
  base: string,
  index: number,
  countryCode?: string,
  adminLevel?: number,
  adminCode?: string,
): string => {
  const baseId = base.trim().length > 0 ? base.trim() : (adminCode ?? `feature-${index}`);
  const prefixParts = [
    countryCode,
    adminLevel != null ? `ADM${adminLevel}` : undefined,
    adminCode,
  ].filter(Boolean);
  const prefix = prefixParts.join('-');
  const composed = prefix ? `${prefix}:${baseId}` : baseId;
  return `${composed}:${index}`;
};

