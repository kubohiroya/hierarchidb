import { getBuildConfigHoverCardSx } from '@hierarchidb/ui-accordion-config';
import { DeleteSweep as DeleteSweepIcon } from '@mui/icons-material';
import { Paper, Stack, Typography } from '@mui/material';
import { SourceConfigFormControls } from './SourceConfigFormControls.tsx';

export type DeleteBuildOutputsCardProps = {
  title: string;
  deleteSourceApiLabel: string;
  deleteSourceFilteredLabel: string;
  deleteGeometryCacheLabel: string;
  deleteTileEmitLabel: string;
  deleteMetadataLabel: string;
  countsLoading?: boolean;
  deleteSourceApiLoading?: boolean;
  deleteSourceFilteredLoading?: boolean;
  deleteGeometryLoading?: boolean;
  deleteTileEmitLoading?: boolean;
  deleteMetadataLoading?: boolean;
  canDeleteSourceApiCache: boolean;
  canDeleteSourceFilteredCache: boolean;
  canDeleteGeometryCache: boolean;
  canDeleteTileEmitCache: boolean;
  canDeleteMetadata: boolean;
  resetDisabled?: boolean;
  disabled?: boolean;
  onDeleteSourceApiCache: () => void;
  onDeleteSourceFilteredCache: () => void;
  onDeleteGeometryCache: () => void;
  onDeleteTileEmitCache: () => void;
  onDeleteMetadata: () => void;
  onResetDefaults: () => void;
};

export const DeleteBuildOutputsCard: React.FC<DeleteBuildOutputsCardProps> = ({
  title,
  deleteSourceApiLabel,
  deleteSourceFilteredLabel,
  deleteGeometryCacheLabel,
  deleteTileEmitLabel,
  deleteMetadataLabel,
  countsLoading,
  deleteSourceApiLoading,
  deleteSourceFilteredLoading,
  deleteGeometryLoading,
  deleteTileEmitLoading,
  deleteMetadataLoading,
  canDeleteSourceApiCache,
  canDeleteSourceFilteredCache,
  canDeleteGeometryCache,
  canDeleteTileEmitCache,
  canDeleteMetadata,
  resetDisabled,
  disabled,
  onDeleteSourceApiCache,
  onDeleteSourceFilteredCache,
  onDeleteGeometryCache,
  onDeleteTileEmitCache,
  onDeleteMetadata,
  onResetDefaults,
}) => {
  const hoverCardSx = getBuildConfigHoverCardSx(disabled);

  return (
    <Paper variant="outlined" sx={{ p: 2, width: '100%', ...hoverCardSx }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} alignItems="center">
          <DeleteSweepIcon fontSize="small" color="primary" />
          <Typography variant="subtitle2">{title}</Typography>
        </Stack>
        <SourceConfigFormControls
          deleteSourceApiLabel={deleteSourceApiLabel}
          deleteSourceFilteredLabel={deleteSourceFilteredLabel}
          deleteGeometryCacheLabel={deleteGeometryCacheLabel}
          deleteTileEmitLabel={deleteTileEmitLabel}
          deleteMetadataLabel={deleteMetadataLabel}
          countsLoading={countsLoading}
          deleteSourceApiLoading={deleteSourceApiLoading}
          deleteSourceFilteredLoading={deleteSourceFilteredLoading}
          deleteGeometryLoading={deleteGeometryLoading}
          deleteTileEmitLoading={deleteTileEmitLoading}
          deleteMetadataLoading={deleteMetadataLoading}
          canDeleteSourceApiCache={canDeleteSourceApiCache}
          canDeleteSourceFilteredCache={canDeleteSourceFilteredCache}
          canDeleteGeometryCache={canDeleteGeometryCache}
          canDeleteTileEmitCache={canDeleteTileEmitCache}
          canDeleteMetadata={canDeleteMetadata}
          onDeleteSourceApiCache={onDeleteSourceApiCache}
          onDeleteSourceFilteredCache={onDeleteSourceFilteredCache}
          onDeleteGeometryCache={onDeleteGeometryCache}
          onDeleteTileEmitCache={onDeleteTileEmitCache}
          onDeleteMetadata={onDeleteMetadata}
          onResetDefaults={onResetDefaults}
          resetDisabled={resetDisabled}
        />
      </Stack>
    </Paper>
  );
};
