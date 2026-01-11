import type React from 'react';
import {
  Box,
  Chip,
  Paper,
  Rating,
  Stack,
  Typography,
} from '@mui/material';
import EngineeringIcon from '@mui/icons-material/Engineering';
import { useTranslation } from '../../i18n.js';

type WorkerNumberConfigCardProps = {
  title: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  icon?: React.ReactNode;
  ratingIcon?: React.ReactNode;
  ratingEmptyIcon?: React.ReactNode;
  onChange: (value: number) => void;
  helperText?: string;
  warningText?: string;
  disabled?: boolean;
};

const formatWorkersLabel = (t: (key: string, fallback?: string, options?: Record<string, unknown>) => string, value: number) =>
  t('processing.workers.countLabel', '{{count}} workers', { count: value });

export const WorkerNumberConfigCard: React.FC<WorkerNumberConfigCardProps> = ({
  title,
  value,
  min = 1,
  max = 8,
  step = 1,
  icon,
  ratingIcon,
  ratingEmptyIcon,
  onChange,
  helperText,
  warningText,
  disabled,
}) => {
  const { t } = useTranslation();
  const clampedValue = Math.max(min, Math.min(max, value));
  const labelValue = Math.round(clampedValue);
  const headerIcon = icon ?? <EngineeringIcon fontSize="large" color="primary" />;
  const ratingFilledIcon = ratingIcon ?? <EngineeringIcon fontSize="small" />;
  const ratingEmptyDisplayIcon = ratingEmptyIcon ?? <EngineeringIcon fontSize="small" color="disabled" />;
  const handleChange = (_: React.SyntheticEvent, next: number | null) => {
    if (disabled) return;
    const resolved = next ?? min;
    onChange(Math.max(min, Math.min(max, resolved)));
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        pl: 1,
        pr: 2,
        borderRadius: 2,
        backgroundColor: (theme) => theme.palette.action.hover,
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        {headerIcon}
        <Typography variant="subtitle2">{title}</Typography>
        <Chip label={formatWorkersLabel(t, labelValue)} size="small" variant="outlined" />
      </Stack>
      <Box px={1} display="flex" alignItems="center">
        <Rating
          value={labelValue}
          max={max}
          onChange={handleChange}
          icon={ratingFilledIcon}
          emptyIcon={ratingEmptyDisplayIcon}
          precision={step}
          disabled={disabled}
        />
      </Box>
      {helperText ? (
        <Typography variant="caption" color="text.secondary">
          {helperText}
        </Typography>
      ) : null}
      {warningText ? (
        <Typography variant="caption" color="error">
          {warningText}
        </Typography>
      ) : null}
    </Paper>
  );
};
