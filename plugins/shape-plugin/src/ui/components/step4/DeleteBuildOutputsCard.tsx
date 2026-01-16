import { Paper, Stack, Typography } from '@mui/material';
import { FetchConfigFormControls } from './FetchConfigFormControls.tsx';

export type DeleteBuildOutputsCardProps = {
  title: string;
  deleteFetchLabel: string;
  deleteTransformFilterLabel: string;
  deleteVTLabel: string;
  deleteMetadataLabel: string;
  countsLoading?: boolean;
  canDeleteFetchCache: boolean;
  canDeleteTransformCache: boolean;
  canDeleteVTCache: boolean;
  canDeleteMetadata: boolean;
  resetDisabled?: boolean;
  onDeleteFetchCache: () => void;
  onDeleteTransformCache: () => void;
  onDeleteVTCache: () => void;
  onDeleteMetadata: () => void;
  onResetDefaults: () => void;
};

export const DeleteBuildOutputsCard: React.FC<DeleteBuildOutputsCardProps> = ({
  title,
  deleteFetchLabel,
  deleteTransformFilterLabel,
  deleteVTLabel,
  deleteMetadataLabel,
  countsLoading,
  canDeleteFetchCache,
  canDeleteTransformCache,
  canDeleteVTCache,
  canDeleteMetadata,
  resetDisabled,
  onDeleteFetchCache,
  onDeleteTransformCache,
  onDeleteVTCache,
  onDeleteMetadata,
  onResetDefaults,
}) => (
  <Paper variant="outlined" sx={{ p: 2, width: '100%' }}>
    <Stack spacing={1.5}>
      <Typography variant="subtitle2">{title}</Typography>
      <FetchConfigFormControls
        deleteFetchLabel={deleteFetchLabel}
        deleteTransformFilterLabel={deleteTransformFilterLabel}
        deleteVTLabel={deleteVTLabel}
        deleteMetadataLabel={deleteMetadataLabel}
        countsLoading={countsLoading}
        canDeleteFetchCache={canDeleteFetchCache}
        canDeleteTransformCache={canDeleteTransformCache}
        canDeleteVTCache={canDeleteVTCache}
        canDeleteMetadata={canDeleteMetadata}
        onDeleteFetchCache={onDeleteFetchCache}
        onDeleteTransformCache={onDeleteTransformCache}
        onDeleteVTCache={onDeleteVTCache}
        onDeleteMetadata={onDeleteMetadata}
        onResetDefaults={onResetDefaults}
        resetDisabled={resetDisabled}
      />
    </Stack>
  </Paper>
);
