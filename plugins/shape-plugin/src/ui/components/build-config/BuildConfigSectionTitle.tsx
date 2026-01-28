import type { ReactNode } from 'react';
import { Stack, Typography } from '@mui/material';

type BuildConfigSectionTitleProps = {
  icon: ReactNode;
  title: string;
};

export const BuildConfigSectionTitle: React.FC<BuildConfigSectionTitleProps> = ({ icon, title }) => (
  <Stack direction="row" spacing={1} alignItems="center">
    {icon}
    <Typography variant="subtitle2">{title}</Typography>
  </Stack>
);
