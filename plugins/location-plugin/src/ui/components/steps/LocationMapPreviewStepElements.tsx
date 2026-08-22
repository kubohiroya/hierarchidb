import type { SvgIconComponent } from '@mui/icons-material';
import { Box, Typography } from '@mui/material';
import type { ReactElement } from 'react';
import type { LocationIconConfig, LocationType } from '~/common/types/index';
import {
  DEFAULT_ICON_IDS,
  DEFAULT_TYPE_COLORS,
  LOCATION_ICON_COMPONENTS,
} from './locationMapPreviewConstants.js';
import { resolveCountryFlag, resolveLocationType } from './locationMapPreviewUtils.js';
import { LOCATION_TYPE_STYLES } from './locationTypes.js';

export type LocationAdmin0FormatterProps = {
  value: unknown;
  row: Record<string, unknown>;
  resolveFlag?: (code?: string) => string | undefined;
};

export const LocationAdmin0Formatter = ({
  value,
  row,
  resolveFlag,
}: LocationAdmin0FormatterProps): ReactElement | null => {
  const name = typeof value === 'string' ? value : '';
  const code = typeof row.admin0Code === 'string' ? row.admin0Code : undefined;
  const flag = resolveFlag ? resolveFlag(code) : resolveCountryFlag(code);
  if (!name && !flag) return null;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      {flag ? <Typography variant="body2">{flag}</Typography> : null}
      <Typography variant="body2">{name}</Typography>
    </Box>
  );
};

export type LocationTypeFormatterProps = {
  value: unknown;
  iconConfig: LocationIconConfig;
  t: (key: string, fallback?: string) => string;
};

export const LocationTypeFormatter = ({
  value,
  iconConfig,
  t,
}: LocationTypeFormatterProps): ReactElement => {
  const rawType = typeof value === 'string' ? value : undefined;
  const type = rawType ? resolveLocationType(rawType) : 'area_centroid';
  const iconEntry = iconConfig[type];
  const iconId = iconEntry?.iconId ?? DEFAULT_ICON_IDS[type];
  const Icon = LOCATION_ICON_COMPONENTS[iconId] ?? LOCATION_TYPE_STYLES[type].icon;
  const color = iconEntry?.color ?? DEFAULT_TYPE_COLORS[type];
  const label = t(`locationTypes.${type}`, type);
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <Icon fontSize="small" htmlColor={color} />
      <Typography variant="body2">{label}</Typography>
    </Box>
  );
};

export type LocationTerrainToggleOption = {
  id: LocationType;
  label: string;
  Icon: SvgIconComponent;
  iconColor: string;
  labelColor: string;
};
