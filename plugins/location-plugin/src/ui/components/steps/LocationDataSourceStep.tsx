/**
 * Location Data Source Selection Step
 */

import type React from 'react';
import { useCallback } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material';
import {
  DataSourceSelectionStep,
  type DataSourceSelectorProps,
  type DataSourceOption,
  IdeGsmImportPanel,
} from '@hierarchidb/ui-datasource';
import type { LocationDataSource, LocationEntity } from '~/common/types/index';
import type { NodeId, Timestamp } from '@hierarchidb/core-types';
import { useLocationDataSourceStep } from './useLocationDataSourceStep.js';

interface LocationDataSourceStepProps {
  draft: Partial<LocationEntity>;
  onUpdate: (updates: Partial<LocationEntity>) => void;
  licenseRequired?: boolean;
  disabled?: boolean;
  nodeId?: NodeId;
  uiState?: Record<string, unknown>;
  onUiStateChange?: (uiState: Record<string, unknown>) => void;
}

export const LocationDataSourceStep: React.FC<LocationDataSourceStepProps> = ({
  draft,
  onUpdate,
  licenseRequired = true,
  disabled,
  nodeId,
}) => {
  const {
    t,
    value,
    description,
    resolvedOptions,
    ideGsmOptionMeta,
    handleSelectionChange,
    removeDialogOpen,
    setRemoveDialogOpen,
    routeRefLoading,
    routeRefError,
    routeRefCount,
    removeInProgress,
    confirmRemoveFile,
    getSupportedIcons,
  } = useLocationDataSourceStep({
    draft,
    onUpdate,
    disabled,
    nodeId,
  });

  const renderOption: DataSourceSelectorProps['renderOption'] = useCallback(
    (option: DataSourceOption, active: boolean) => {
      const icons = getSupportedIcons(option.id as LocationDataSource);
      const isIdeGsm = option.id === 'ide-gsm';
      const ideGsmPanel = ideGsmOptionMeta;
      return (
        <Stack spacing={0.5}>
          <Typography variant="subtitle1">
            {option.icon} {option.name}
          </Typography>
          {option.description && (
            <Typography variant="body2" color="text.secondary">
              {option.description}
            </Typography>
          )}
          <Box display="flex" gap={1} alignItems="center">
            <Typography variant="caption" color="text.secondary">
              Supported types:
            </Typography>
            <Typography variant="caption">{icons}</Typography>
          </Box>
          {isIdeGsm && active && ideGsmPanel ? (
            <Box
              data-ignore-select="true"
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
            >
              <IdeGsmImportPanel
                files={ideGsmPanel.files}
                labels={ideGsmPanel.labels}
                defaultDownloadUrl={ideGsmPanel.defaultDownloadUrl}
                disabled={ideGsmPanel.disabled}
                onAddFile={ideGsmPanel.onAddFile}
                onRemoveFile={ideGsmPanel.onRemoveFile}
              />
            </Box>
          ) : null}
        </Stack>
      );
    },
    [getSupportedIcons, ideGsmOptionMeta],
  );

  return (
    <Box>
      <DataSourceSelectionStep<Timestamp>
        title={String(t('dataSource.title', 'Data Source'))}
        options={resolvedOptions}
        state={{
          dataSourceId: value,
          licenseAgreement: Boolean(draft.licenseAgreement),
          licenseAgreedAt: draft.licenseAgreedAt,
        }}
        onChange={handleSelectionChange}
        licenseRequired={licenseRequired}
        licenseRequiredText={String(t(
          'dataSource.licenseRequired',
          'License agreement is required to proceed.',
        ))}
        disabled={disabled}
        description={description}
        renderOption={renderOption}
        createAgreedAt={() => Date.now() as Timestamp}
        selectionTitle={String(t('dataSource.selectionTitle', 'Data Source'))}
        detailsTitle={String(t('dataSource.detailsTitle', 'Data Source Details'))}
        showDetailsCard={false}
      />
      <Dialog
        open={removeDialogOpen}
        onClose={() => {
          setRemoveDialogOpen(false);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {t('dataSource.ideGsm.removeConfirmTitle', 'Remove IDE-GSM file?')}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Typography variant="body2">
            {t(
              'dataSource.ideGsm.removeConfirmMessage',
              'Removing this file will discard its locations and re-import the remaining files.',
            )}
          </Typography>
          {routeRefCount != null && routeRefCount > 0 ? (
            <Typography variant="body2" color="warning.main">
              {t(
                'dataSource.ideGsm.removeCascadeWarning',
                'Referenced routes will also be deleted to keep route/location consistency.',
              )}
            </Typography>
          ) : null}
          {routeRefLoading ? (
            <Typography variant="body2" color="text.secondary">
              {t('dataSource.ideGsm.routeRefLoading', 'Checking route references...')}
            </Typography>
          ) : routeRefError ? (
            <Typography variant="body2" color="error">
              {t('dataSource.ideGsm.routeRefError', 'Failed to check route references.')} {routeRefError}
            </Typography>
          ) : routeRefCount != null ? (
            <Typography variant="body2" color={routeRefCount > 0 ? 'error' : 'text.secondary'}>
              {t(
                'dataSource.ideGsm.routeRefCount',
                'Routes referencing this location node: {count}',
              ).replace('{count}', String(routeRefCount))}
            </Typography>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setRemoveDialogOpen(false);
            }}
          >
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button onClick={confirmRemoveFile} color="error" variant="contained" disabled={removeInProgress}>
            {t('dataSource.ideGsm.removeConfirmAction', 'Remove')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
