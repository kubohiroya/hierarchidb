import type React from 'react';
import { Box } from '@mui/material';
import { BuildStepPanel, type BuildStepPanelProps } from './BuildStepPanel.tsx';

export type BuildProgressPanelProps = BuildStepPanelProps & {
  footer?: React.ReactNode;
};

export const BuildProgressPanel: React.FC<BuildProgressPanelProps> = ({
  footer,
  ...panelProps
}) => {
  return (
    <Box display="flex" flexDirection="column" gap={3} height="100%" minHeight={0}>
      <Box flex={1} minHeight={0}>
        <BuildStepPanel {...panelProps} />
      </Box>
      {footer}
    </Box>
  );
};
