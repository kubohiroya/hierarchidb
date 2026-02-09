import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Button,
  FormControlLabel,
  FormGroup,
  Paper,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import {
  DeleteSweep as DeleteSweepIcon,
  ExpandMore as ExpandMoreIcon,
  Inventory2 as Inventory2Icon,
} from '@mui/icons-material';
import type { ShapeBuildConfig } from '../../../common/types/index.js';
import type { FetchConfigSectionState } from './useFetchConfigSection.ts';
import { useTranslation } from '../../i18n.js';
import { getBuildConfigHoverCardSx } from '@hierarchidb/ui-accordion-config';

type Props = {
  config: ShapeBuildConfig;
  fetchState: FetchConfigSectionState;
  disabled?: boolean;
};

export const CacheManagementSection: React.FC<Props> = ({ config, fetchState, disabled }) => {
  const { t } = useTranslation();
  const {
    switchId,
    handleResetDefaults,
    update,
  } = fetchState;

  const hoverCardSx = getBuildConfigHoverCardSx(disabled);

  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={2} alignItems="center">
          <DeleteSweepIcon color="primary" />
          <Typography variant="subtitle1">
            {t('processing.cache.title', 'Cache management')}
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 3 }}>
        <Stack spacing={2} direction={{ xs: 'column', lg: 'row' }} alignItems="stretch">
          <Paper
            variant="outlined"
            sx={{ p: 2, width: '100%', flex: 1, minWidth: 0, ...hoverCardSx }}
          >
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Inventory2Icon fontSize="small" color="primary" />
                <Typography variant="subtitle2">
                  {t('processing.download.retainTitle', 'Retain intermediate outputs after build')}
                </Typography>
              </Stack>
              <FormGroup>
                <FormControlLabel
                  control={
                    <Switch
                      checked={!config.cleanupConfig?.deleteFetchApiCache}
                      onChange={(event) => {
                        const retainFiles = event.target.checked;
                        update({
                          cleanupConfig: {
                            ...config.cleanupConfig,
                            deleteFetchApiCache: !retainFiles,
                          },
                        });
                      }}
                      disabled={disabled}
                      inputProps={{
                        id: `${switchId}-retain-fetch-api-cache`,
                        name: 'retain-fetch-api-cache',
                      }}
                    />
                  }
                  label={t('processing.download.retainApiCache', 'API cache')}
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={!config.cleanupConfig?.deleteFetchFilteredCache}
                      onChange={(event) => {
                        const retainCache = event.target.checked;
                        update({
                          cleanupConfig: {
                            ...config.cleanupConfig,
                            deleteFetchFilteredCache: !retainCache,
                          },
                        });
                      }}
                      disabled={disabled}
                      inputProps={{
                        id: `${switchId}-retain-fetch-filtered-cache`,
                        name: 'retain-fetch-filtered-cache',
                      }}
                    />
                  }
                  label={t('processing.download.retainFilteredCache', 'Filtered cache')}
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={!config.cleanupConfig?.deleteTransformCache}
                      onChange={(event) => {
                        const retainCache = event.target.checked;
                        update({
                          cleanupConfig: {
                            ...config.cleanupConfig,
                            deleteTransformCache: !retainCache,
                          },
                        });
                      }}
                      disabled={disabled}
                      inputProps={{
                        id: `${switchId}-retain-stage1-cache`,
                        name: 'retain-stage1-cache',
                      }}
                    />
                  }
                  label={t('processing.download.retainStage1Cache', 'Simplified cache')}
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={!config.cleanupConfig?.deleteVTCache}
                      onChange={(event) => {
                        const retainCache = event.target.checked;
                        update({
                          cleanupConfig: {
                            ...config.cleanupConfig,
                            deleteVTCache: !retainCache,
                          },
                        });
                      }}
                      disabled={disabled}
                      inputProps={{
                        id: `${switchId}-retain-vt-cache`,
                        name: 'retain-vt-cache',
                      }}
                    />
                  }
                  label={t('processing.download.retainVtCache', 'Tile data')}
                />
              </FormGroup>
            </Stack>
          </Paper>
          <Stack sx={{ flex: 1, minWidth: 0 }}>
            <Button
              fullWidth
              variant="outlined"
              color="warning"
              disabled={disabled}
              onClick={handleResetDefaults}
            >
              {t('processing.download.resetDefaultsAction', 'Reset to defaults')}
            </Button>
          </Stack>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};
