import type { ReactElement } from 'react';
import { Box, Typography } from '@mui/material';
import type { SvgIconComponent } from '@mui/icons-material';
import type { LocationType } from '~/common/types/index';

export type LocationMapPreviewIconProps = {
  Icon: SvgIconComponent;
  color: string;
};

export const LocationMapPreviewIcon = ({ Icon, color }: LocationMapPreviewIconProps): ReactElement => (
  <Icon htmlColor={color} />
);

export type LocationPreviewHoverMatch = {
  id: string;
  index: number;
  name?: string;
  type: LocationType;
  typeLabel: string;
  region?: string;
  countryLabel?: string;
  miniMapX: number;
  miniMapY: number;
  Icon: SvgIconComponent;
  color: string;
};

export type LocationPreviewHoverSnackbarProps = {
  matches: LocationPreviewHoverMatch[];
  isDarkMode: boolean;
};

export const LocationPreviewHoverSnackbar = ({
  matches,
  isDarkMode,
}: LocationPreviewHoverSnackbarProps): ReactElement | null => {
  if (matches.length === 0) return null;
  const snackbarBg = isDarkMode ? 'rgba(32,32,36,0.92)' : 'rgba(255,255,255,0.96)';
  const snackbarText = isDarkMode ? '#F5F5F7' : '#1F1F24';
  const radarFill = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';
  const radarStroke = isDarkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.18)';
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1.5,
        minWidth: 320,
        color: snackbarText,
        bgcolor: snackbarBg,
        borderRadius: 1.5,
        px: 1.5,
        py: 1,
      }}
    >
      <Box sx={{ width: 64, height: 64, flex: '0 0 64px' }}>
        <svg width={64} height={64} viewBox="0 0 64 64">
          <title>miniRader</title>
          <circle cx={32} cy={32} r={32} fill={radarFill} />
          <circle cx={32} cy={32} r={31.5} fill="none" stroke={radarStroke} />
          {matches.map((match) => (
            <g key={match.id}>
              <text
                x={match.miniMapX}
                y={match.miniMapY}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="10"
                fontWeight="700"
                fill={match.color}
              >
                {match.index}
              </text>
            </g>
          ))}
        </svg>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 220 }}>
        {matches.map((match) => (
          <Box key={match.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" sx={{ width: 18, textAlign: 'right' }}>
              {match.index}.
            </Typography>
            <match.Icon fontSize="small" htmlColor={match.color} />
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              {match.name ? (
                <Typography variant="body2" sx={{ fontWeight: 600, color: snackbarText }}>
                  {match.name}
                </Typography>
              ) : null}
              <Typography
                variant="caption"
                sx={{ color: isDarkMode ? 'rgba(245,245,247,0.7)' : 'rgba(31,31,36,0.6)' }}
              >
                {[match.region, match.countryLabel].filter(Boolean).join(' / ')}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
};
