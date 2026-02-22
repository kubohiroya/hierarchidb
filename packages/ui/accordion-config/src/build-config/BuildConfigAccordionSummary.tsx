import { InfoOutlined as InfoOutlinedIcon } from '@mui/icons-material';
import { Stack, Tooltip, Typography } from '@mui/material';
import type { ReactNode } from 'react';

type BuildConfigAccordionSummaryProps = {
  icon: ReactNode;
  title: string;
  info: string;
};

export const BuildConfigAccordionSummary: React.FC<BuildConfigAccordionSummaryProps> = ({
  icon,
  title,
  info,
}) => (
  <Stack direction="row" spacing={2} alignItems="center">
    {icon}
    <Typography variant="subtitle1" sx={{ fontSize: 'calc(1rem + 2px)', color: 'primary.main' }}>
      {title}
    </Typography>
    <Tooltip title={info} placement="top">
      <InfoOutlinedIcon color="action" fontSize="small" />
    </Tooltip>
  </Stack>
);
