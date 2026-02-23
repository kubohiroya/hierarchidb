import type { ReactElement } from 'react';
import {
  Alert,
  Box,
  Checkbox,
  Paper,
  Typography,
} from '@mui/material';

export type RoutePreviewHoverMatch = {
  id: string;
  index: number;
  linePath: string;
  summaryLine: string;
  routeName: string;
  distanceLabel: string;
  modeColor: string;
  isSelected: boolean;
  miniMapLabelX: number;
  miniMapLabelY: number;
};

export type RoutePreviewHoverSnackbarProps = {
  matches: RoutePreviewHoverMatch[];
  isDarkMode: boolean;
  popupHint?: string;
  onToggleMatchSelection: (matchId: string) => void;
};

export const RoutePreviewHoverSnackbar = ({
  matches,
  isDarkMode,
  popupHint,
  onToggleMatchSelection,
}: RoutePreviewHoverSnackbarProps): ReactElement | null => {
  if (matches.length === 0) return null;

  const rootBg = isDarkMode ? 'rgba(22, 22, 26, 0.96)' : 'rgba(255,255,255,0.96)';
  const textColor = isDarkMode ? '#F4F5F7' : '#16181D';
  const radarFill = isDarkMode ? 'rgba(244,245,247,0.12)' : 'rgba(22,24,29,0.07)';
  const radarStroke = isDarkMode ? 'rgba(244,245,247,0.36)' : 'rgba(22,24,29,0.28)';
  const selectedText = isDarkMode ? '#8CFFC8' : '#1B5E20';
  const selectedPathColor = isDarkMode ? '#8CFFC8' : '#0D47A1';
  const subTextColor = isDarkMode ? 'rgba(244,245,247,0.72)' : 'rgba(22,24,29,0.62)';

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'absolute',
        left: 12,
        bottom: 12,
        p: 1,
        minWidth: 340,
        maxWidth: 440,
        color: textColor,
        bgcolor: rootBg,
        borderRadius: 1.5,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{ width: 84, height: 84, flex: '0 0 84px' }}>
          <svg width={84} height={84} viewBox="0 0 84 84" aria-label="route-mini-radar">
            <circle cx={42} cy={42} r={42} fill={radarFill} />
            <circle cx={42} cy={42} r={41.5} fill="none" stroke={radarStroke} />
            {matches.map((match) => (
              <g key={`path-${match.id}`}>
                {match.isSelected ? (
                  <polyline
                    points={match.linePath}
                    fill="none"
                    stroke={selectedPathColor}
                    strokeWidth={4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.35}
                  />
                ) : null}
                <polyline
                  points={match.linePath}
                  fill="none"
                  stroke={match.modeColor}
                  strokeWidth={match.isSelected ? 2.7 : 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.95}
                />
                <circle
                  cx={match.miniMapLabelX}
                  cy={match.miniMapLabelY}
                  r={9}
                  fill={match.isSelected ? selectedPathColor : (isDarkMode ? '#121212' : '#ffffff')}
                  fillOpacity={match.isSelected ? 0.2 : 0.75}
                  stroke={match.isSelected ? selectedPathColor : match.modeColor}
                  strokeWidth={match.isSelected ? 2 : 1}
                />
                <text
                  x={match.miniMapLabelX}
                  y={match.miniMapLabelY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="10"
                  fontWeight="700"
                  fill={match.modeColor}
                  stroke={match.isSelected ? rootBg : (isDarkMode ? '#121212' : '#ffffff')}
                  strokeWidth={3}
                  paintOrder="stroke"
                  opacity={match.isSelected ? 1 : 0.9}
                >
                  {match.index}
                </text>
                <text
                  x={match.miniMapLabelX}
                  y={match.miniMapLabelY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="10"
                  fontWeight="700"
                  fill={match.modeColor}
                >
                  {match.index}
                </text>
              </g>
            ))}
          </svg>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, minWidth: 240 }}>
          {popupHint ? (
            <Typography
              variant="caption"
              sx={{ color: subTextColor, mb: 0.25 }}
            >
              {popupHint}
            </Typography>
          ) : null}
            {matches.map((match) => (
              <Box
                key={`label-${match.id}`}
                onClick={() => onToggleMatchSelection(match.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
                    event.preventDefault();
                    onToggleMatchSelection(match.id);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`Select route ${match.index}`}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1,
                  cursor: 'pointer',
                }}
              >
                <Box
                  sx={{
                    width: 24,
                    minWidth: 24,
                    mt: 0.25,
                    borderRadius: '50%',
                    border: `1px solid ${match.isSelected ? selectedPathColor : radarStroke}`,
                    color: match.isSelected ? selectedPathColor : textColor,
                    backgroundColor: match.isSelected ? `${selectedPathColor}22` : 'transparent',
                    lineHeight: '16px',
                    fontSize: '12px',
                    height: 18,
                    textAlign: 'center',
                    fontFamily: 'inherit',
                    padding: 0,
                    flexShrink: 0,
                    appearance: 'none',
                    borderColor: match.isSelected ? selectedPathColor : radarStroke,
                    '&:focus-visible': {
                      outline: `2px solid ${selectedText}`,
                      outlineOffset: 1,
                    },
                  }}
                  aria-hidden="true"
                >
                  {match.index}.
                </Box>
                <Box sx={{ mt: -0.1 }}>
                  <Checkbox
                    size="small"
                    checked={match.isSelected}
                    onChange={(event) => {
                      event.stopPropagation();
                      onToggleMatchSelection(match.id);
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                    }}
                    inputProps={{ 'aria-label': `Select route ${match.index}` }}
                    sx={{
                      p: 0.25,
                      mr: 0,
                      color: match.isSelected ? selectedPathColor : radarStroke,
                    }}
                  />
                </Box>
                <Box>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 600,
                      lineHeight: 1.2,
                      color: match.isSelected ? selectedText : textColor,
                    }}
                  >
                    {match.summaryLine}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: match.isSelected ? selectedText : subTextColor }}
                  >
                    {match.routeName}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: match.isSelected ? selectedText : subTextColor }}
                  >
                    {match.distanceLabel}
                  </Typography>
                </Box>
              </Box>
            ))}
        </Box>
      </Box>
    </Paper>
  );
};

export type RoutePreviewEmptyContentProps = {
  message: string;
};

export const RoutePreviewEmptyContent = ({ message }: RoutePreviewEmptyContentProps): ReactElement => (
  <Alert severity="info" sx={{ m: 2 }}>
    {message}
  </Alert>
);
