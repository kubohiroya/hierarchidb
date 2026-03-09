import {
  Alert,
  Grid,
  Typography,
  Stack,
  TextField,
} from '@mui/material';
import { Link as LinkIcon } from '@mui/icons-material';
import { BuildConfigSectionTitle } from '@hierarchidb/ui-accordion-config';
import { useTranslation } from '@hierarchidb/ui-i18n';
import type {
  ShapeBuildConfig,
} from '~/common/types/index';
import { useUrlBuildConfigRulesSection } from './useUrlBuildConfigRulesSection.js';

type Props = {
  config: ShapeBuildConfig;
  onChange: (next: ShapeBuildConfig | ((prev: ShapeBuildConfig) => ShapeBuildConfig)) => void;
  disabled?: boolean;
};

export const UrlBuildConfigRulesSection: React.FC<Props> = ({ config, onChange, disabled }) => {
  const { t } = useTranslation('shape-plugin');
  const { text, error, handleBlur, handleChange } = useUrlBuildConfigRulesSection({ config, onChange });

  return (
    <Stack spacing={1.5} sx={{ opacity: disabled ? 0.6 : 1 }}>
      <BuildConfigSectionTitle
        icon={<LinkIcon fontSize="small" color="primary" />}
        title={t('processing.urlRules.sectionTitle', 'URL-specific rules')}
      />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            size="small"
            multiline
            minRows={8}
            value={text}
            disabled={disabled}
            onChange={(event) => handleChange(event.target.value)}
            onBlur={handleBlur}
            error={Boolean(error)}
            helperText={error}
            fullWidth
            sx={{
              '& .MuiInputBase-root': {
                alignItems: 'stretch',
                lineHeight: 1.5,
                fontFamily: 'monospace',
                overflow: 'auto',
              },
              '& textarea': {
                resize: 'both',
              },
            }}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Alert severity="info" sx={{ whiteSpace: 'pre-wrap', height: '100%' }}>
            {t(
              'processing.urlRules.example',
              `Example:
[
  { "key": "default", "matchType": "default", "buildConfig": { "geometryConfig": { "toleranceByBand": [0.12, 0.11, 0.1, 0.09, 0.08] } } },
  { "key": "russia-coast", "matchType": "regexp", "pattern": "(?i).*russia.*", "buildConfig": { "geometryConfig": { "toleranceByBand": [0.3, 0.25, 0.2, 0.18, 0.16] } }
]`,
            )}
          </Alert>
        </Grid>
      </Grid>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ whiteSpace: 'pre-wrap' }}
      >
        {t(
          'processing.urlRules.description',
          'Define per-URL overrides in JSON. This JSON is evaluated in order and each entry applies to matching URLs.',
        )}
      </Typography>
    </Stack>
  );
};
