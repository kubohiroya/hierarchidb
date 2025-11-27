import { useMemo } from 'react';
import { Alert, Box, Typography } from '@mui/material';
import type { LocationEntity } from '../../../common/types/index.js';
import { useTranslation } from '../../../common/i18n/index.js';

type Props = {
  nodeId?: string;
  draft: Partial<LocationEntity>;
};

export const LocationBuildStep: React.FC<Props> = ({ nodeId, draft: draftProp }) => {
  const { translations } = useTranslation();
  const draft = useMemo(() => draftProp ?? {}, [draftProp]);

  const canBuild = useMemo(
    () => Boolean(nodeId && draft.licenseAgreement && draft.dataSource),
    [draft.dataSource, draft.licenseAgreement, nodeId]
  );

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      {!canBuild && (
        <Alert severity="info">
          {translations.build?.requiresApproval ??
            'Provide a data source, accept license terms, and save the node before building.'}
        </Alert>
      )}
      <Box>
        <Typography variant="h6" gutterBottom>
          {translations.basicInfo?.title ?? 'Build vector tiles'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {translations.basicInfo?.descriptionHelperText ??
            'Prepare the selected locations and start the batch pipeline to generate the basemap layers.'}
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary">
        {translations.build?.actionLabel
          ? `${translations.build.actionLabel} will start from the dialog footer when prerequisites are met.`
          : 'Use the Build button in the dialog footer once all required steps are completed.'}
      </Typography>
    </Box>
  );
};
