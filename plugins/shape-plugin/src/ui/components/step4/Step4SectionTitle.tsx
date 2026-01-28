import type { ReactNode } from 'react';
import { Stack, Typography } from '@mui/material';

type Step4SectionTitleProps = {
  icon: ReactNode;
  title: string;
};

export const Step4SectionTitle: React.FC<Step4SectionTitleProps> = ({ icon, title }) => (
  <Stack direction="row" spacing={1} alignItems="center">
    {icon}
    <Typography variant="subtitle2">{title}</Typography>
  </Stack>
);
