import type { ReactNode } from 'react';

export type BuildStage = {
  id: string;
  title: string;
  icon?: ReactNode;
  description?: string;
};