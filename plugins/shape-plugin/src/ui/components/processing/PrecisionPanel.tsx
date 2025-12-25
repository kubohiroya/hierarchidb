import {
  Rating,
  Stack,
  Typography,
} from '@mui/material';
import { useTranslation } from '../../i18n.js';

type Props = {
  quantize: number;
  quantizeOptions: number[];
  quantizeRank: number;
  quantizeLabel: string;
  disabled?: boolean;
  onQuantizeChange: (value: number) => void;
};

export const PrecisionPanel: React.FC<Props> = ({
  quantize,
  quantizeOptions,
  quantizeRank,
  quantizeLabel,
  disabled,
  onQuantizeChange,
}) => {
  const { t } = useTranslation();

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2">
        {t('processing.filter.precisionTitle', 'Precision & Compression')}
      </Typography>
      <div>
        <Typography gutterBottom>
          {t('processing.filter.quantize', 'Coordinate Quantization')}
        </Typography>
        <Rating
          value={quantizeRank}
          max={quantizeOptions.length}
          onChange={(_, value) => {
            const index = Math.max(0, (value ?? 1) - 1);
            const nextQuantize = quantizeOptions[index] ?? quantize;
            onQuantizeChange(nextQuantize);
          }}
          disabled={disabled}
        />
        <Typography variant="caption" color="text.secondary">
          {t('processing.filter.quantizeSelected', 'Selected: {value}', { value: quantizeLabel || quantize.toLocaleString() })}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('processing.filter.quantizeHelp', 'Quantization factor used in simplify stage 2.')}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('processing.filter.quantizeStarHelp', '★1 is the coarsest rounding (lowest precision); higher stars increase precision.')}
        </Typography>
      </div>
    </Stack>
  );
};
