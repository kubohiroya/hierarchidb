import type { ReactElement } from 'react';
import type { SvgIconComponent } from '@mui/icons-material';

export type LocationViewportIconProps = {
  Icon: SvgIconComponent;
  color: string;
};

export const LocationViewportIcon = ({ Icon, color }: LocationViewportIconProps): ReactElement => (
  <Icon htmlColor={color} />
);
