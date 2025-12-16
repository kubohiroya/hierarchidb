import React from 'react';
import { Accordion, AccordionDetails, AccordionSummary, FormControlLabel, Switch, Typography } from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import type { ProcessingConfig } from '../../../../common/types/index.js';
import { mergeProcessingConfig } from '../../../../common/types/index.js';
import { useId } from 'react';

type Props = {
  config: ProcessingConfig;
  disabled?: boolean;
  onChange: (next: ProcessingConfig) => void;
};

export const CleanupConfigSection: React.FC<Props> = ({ config, disabled, onChange }) => {
  const switchId = useId();
  const update = (partial: Partial<ProcessingConfig>) => {
    onChange(mergeProcessingConfig({ ...config, ...partial }));
  };

  return (
    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle1">Cleanup</Typography>
      </AccordionSummary>
      <AccordionDetails>
          <FormControlLabel
            control={
              <Switch
                checked={config?.cleanupConfig?.deleteDownloadedFiles ?? false}
                onChange={(e) => {
                update({
                  cleanupConfig: {
                    ...config.cleanupConfig,
                    deleteDownloadedFiles: e.target.checked,
                  },
                });
                }}
                disabled={disabled}
                inputProps={{
                  id: `${switchId}-delete-downloaded-files`,
                  name: 'delete-downloaded-files',
                }}
              />
            }
            label="Delete downloaded files after processing"
          />
        </AccordionDetails>
    </Accordion>
  );
};
