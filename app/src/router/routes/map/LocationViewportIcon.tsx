import type { SvgIconComponent } from '@mui/icons-material';
import type { ReactElement } from 'react';

export type LocationViewportIconProps = {
  Icon: SvgIconComponent;
  color: string;
};

export const LocationViewportIcon = ({ Icon, color }: LocationViewportIconProps): ReactElement => (
  <Icon htmlColor={color} />
);
