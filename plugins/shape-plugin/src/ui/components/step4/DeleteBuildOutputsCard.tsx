import { Paper, Stack, Typography } from '@mui/material';
import { DeleteSweep as DeleteSweepIcon } from '@mui/icons-material';
import { FetchConfigFormControls } from './FetchConfigFormControls.tsx';

export type DeleteBuildOutputsCardProps = {
  title: string;
  deleteFetchApiLabel: string;
  deleteFetchFilteredLabel: string;
  deleteTransformFilterLabel: string;
  deleteVTLabel: string;
  deleteMetadataLabel: string;
  countsLoading?: boolean;
  canDeleteFetchApiCache: boolean;
  canDeleteFetchFilteredCache: boolean;
  canDeleteTransformCache: boolean;
  canDeleteVTCache: boolean;
  canDeleteMetadata: boolean;
  resetDisabled?: boolean;
  disabled?: boolean;
  onDeleteFetchApiCache: () => void;
  onDeleteFetchFilteredCache: () => void;
  onDeleteTransformCache: () => void;
  onDeleteVTCache: () => void;
  onDeleteMetadata: () => void;
  onResetDefaults: () => void;
};

export const DeleteBuildOutputsCard: React.FC<DeleteBuildOutputsCardProps> = ({
  title,
  deleteFetchApiLabel,
  deleteFetchFilteredLabel,
  deleteTransformFilterLabel,
  deleteVTLabel,
  deleteMetadataLabel,
  countsLoading,
  canDeleteFetchApiCache,
  canDeleteFetchFilteredCache,
  canDeleteTransformCache,
  canDeleteVTCache,
  canDeleteMetadata,
  resetDisabled,
  disabled,
  onDeleteFetchApiCache,
  onDeleteFetchFilteredCache,
  onDeleteTransformCache,
  onDeleteVTCache,
  onDeleteMetadata,
  onResetDefaults,
}) => {
  const hoverCardSx = disabled
    ? {}
    : {
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: (theme: { shadows: string[] }) => theme.shadows[8],
        },
      };

  return (
    <Paper variant="outlined" sx={{ p: 2, width: '100%', ...hoverCardSx }}>
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} alignItems="center">
        <DeleteSweepIcon fontSize="small" color="primary" />
        <Typography variant="subtitle2">{title}</Typography>
      </Stack>
      <FetchConfigFormControls
        deleteFetchApiLabel={deleteFetchApiLabel}
        deleteFetchFilteredLabel={deleteFetchFilteredLabel}
        deleteTransformFilterLabel={deleteTransformFilterLabel}
        deleteVTLabel={deleteVTLabel}
        deleteMetadataLabel={deleteMetadataLabel}
        countsLoading={countsLoading}
        canDeleteFetchApiCache={canDeleteFetchApiCache}
        canDeleteFetchFilteredCache={canDeleteFetchFilteredCache}
        canDeleteTransformCache={canDeleteTransformCache}
        canDeleteVTCache={canDeleteVTCache}
        canDeleteMetadata={canDeleteMetadata}
        onDeleteFetchApiCache={onDeleteFetchApiCache}
        onDeleteFetchFilteredCache={onDeleteFetchFilteredCache}
        onDeleteTransformCache={onDeleteTransformCache}
        onDeleteVTCache={onDeleteVTCache}
        onDeleteMetadata={onDeleteMetadata}
        onResetDefaults={onResetDefaults}
        resetDisabled={resetDisabled}
      />
    </Stack>
  </Paper>
  );
};
