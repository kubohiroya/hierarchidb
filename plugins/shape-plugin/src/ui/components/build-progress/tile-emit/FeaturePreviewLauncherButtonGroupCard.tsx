import { Box, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material';

export type FeaturePreviewLauncherItem = {
  id: string;
  label: string;
  countryCode?: string | null;
  tooltip: string;
};

type FeaturePreviewLauncherButtonGroupCardProps = {
  items: FeaturePreviewLauncherItem[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
  onHoverChange?: (id: string | null) => void;
};

const toFlagEmoji = (countryCode: string | null | undefined): string | null => {
  if (!countryCode) return null;
  const normalized = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return null;
  const base = 0x1f1e6;
  const first = normalized.charCodeAt(0) - 65 + base;
  const second = normalized.charCodeAt(1) - 65 + base;
  return String.fromCodePoint(first, second);
};

export const FeaturePreviewLauncherButtonGroupCard = ({
  items,
  selectedId,
  onSelect,
  onHoverChange,
}: FeaturePreviewLauncherButtonGroupCardProps) => {
  return (
    <Paper variant="outlined" sx={{ p: 1.25 }}>
      <Stack spacing={1}>
        {items.length === 0 ? (
          <Typography variant="caption" color="text.secondary">
            No intersecting features.
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0 }}>
            {items.map((item) => {
              const flag = toFlagEmoji(item.countryCode ?? null);
              const isSelected = selectedId === item.id;
              return (
                <Tooltip key={item.id} title={item.tooltip} arrow>
                  <IconButton
                    size="small"
                    onClick={() => onSelect(item.id)}
                    onMouseEnter={() => onHoverChange?.(item.id)}
                    onMouseLeave={() => onHoverChange?.(null)}
                    aria-label={item.label}
                    sx={{
                      p: '0.5px',
                      m: '0.5px',
                      height: '19px',
                      width: '19px',
                      border: '1px solid',
                      borderColor: isSelected ? 'primary.main' : 'divider',
                      bgcolor: isSelected ? 'primary.main' : 'transparent',
                      color: isSelected ? 'primary.contrastText' : 'text.primary',
                    }}
                  >
                    <span aria-hidden style={{ fontSize: '20.3px', lineHeight: 1 }}>
                      {flag ?? '?'}
                    </span>
                  </IconButton>
                </Tooltip>
              );
            })}
          </Box>
        )}
      </Stack>
    </Paper>
  );
};
