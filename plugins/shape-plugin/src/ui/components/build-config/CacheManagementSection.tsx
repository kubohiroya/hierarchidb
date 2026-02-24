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
} from '@mui/material';
import {
  DeleteSweep as DeleteSweepIcon,
  ExpandMore as ExpandMoreIcon,
  Inventory2 as Inventory2Icon,
} from '@mui/icons-material';
import type { ShapeBuildConfig } from '~/common/types/index';
import type { FetchConfigSectionState } from '~/ui/hooks/useFetchConfigSection';
import { useTranslation } from '~/ui/i18n';
import {
  BuildConfigSectionTitle,
  BuildConfigAccordionSummary,
  getBuildConfigHoverCardSx,
} from '@hierarchidb/ui-accordion-config';
import { UrlBuildConfigRulesSection } from './UrlBuildConfigRulesSection.tsx';

type Props = {
  config: ShapeBuildConfig;
  onChange: (next: ShapeBuildConfig) => void;
  fetchState: FetchConfigSectionState;
  disabled?: boolean;
  disableHoverLift?: boolean;
};

export const CacheManagementSection: React.FC<Props> = ({
  config,
  onChange,
  fetchState,
  disabled,
  disableHoverLift = false,
}) => {
  const { t } = useTranslation();
  const {
    switchId,
    handleResetDefaults,
    update,
  } = fetchState;

  const hoverCardSx = getBuildConfigHoverCardSx(disabled, disableHoverLift);

  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <BuildConfigAccordionSummary
          icon={<DeleteSweepIcon color="primary" />}
          title={t('processing.cache.title', 'Miscellaneous')}
          info={t(
            'processing.cache.descriptionTooltip',
            'Control how build outputs are retained or removed after each stage.',
          )}
        />
      </AccordionSummary>
      <AccordionDetails sx={{ p: 3 }}>
        <Stack spacing={2} alignItems="stretch">
          <Paper
            variant="outlined"
            sx={{ p: 2, width: '100%', flex: 1, minWidth: 0, ...hoverCardSx }}
          >
            <Stack spacing={1.5}>
              <BuildConfigSectionTitle
                icon={<DeleteSweepIcon fontSize="small" color="primary" />}
                title={t('processing.download.resetDefaultsAction', 'Reset to defaults')}
              />
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
          </Paper>
          <Paper
            variant="outlined"
            sx={{ p: 2, width: '100%', flex: 1, minWidth: 0, ...hoverCardSx }}
          >
            <Stack spacing={1.5}>
              <BuildConfigSectionTitle
                icon={<Inventory2Icon fontSize="small" color="primary" />}
                title={t(
                  'processing.download.retainTitle',
                  'Retail intermediate outputs after build'
                )}
              />
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
          <Paper
            variant="outlined"
            sx={{ p: 2, width: '100%', flex: 1, minWidth: 0, ...hoverCardSx }}
          >
            <UrlBuildConfigRulesSection config={config} onChange={onChange} disabled={disabled} />
          </Paper>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};
