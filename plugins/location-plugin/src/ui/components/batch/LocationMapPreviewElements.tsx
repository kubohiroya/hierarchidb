import type { ReactElement } from 'react';
import { Box } from '@mui/material';
import type { SvgIconComponent } from '@mui/icons-material';

export type LocationMapPreviewMarkerEntry = {
  id: string;
  title: string;
  left: number;
  top: number;
  size: number;
  color: string;
  isHovered: boolean;
  useIcon: boolean;
  Icon?: SvgIconComponent;
  iconSize?: number;
};

export type LocationMapPreviewMarkersProps = {
  markers: LocationMapPreviewMarkerEntry[];
};

export const LocationMapPreviewMarkers = ({
  markers,
}: LocationMapPreviewMarkersProps): ReactElement => (
  <>
    {markers.map((marker) => {
      if (!marker.useIcon) {
        return (
          <Box
            key={marker.id}
            title={marker.title}
            sx={{
              position: 'absolute',
              left: marker.left,
              top: marker.top,
              width: marker.size,
              height: marker.size,
              bgcolor: marker.color,
              borderRadius: 0,
              opacity: 0.85,
              boxShadow: marker.isHovered ? `0 0 12px ${marker.color}` : 'none',
              zIndex: marker.isHovered ? 2 : 1,
            }}
          />
        );
      }

      const Icon = marker.Icon;
      return (
        <Box
          key={marker.id}
          title={marker.title}
          sx={{
            position: 'absolute',
            left: marker.left,
            top: marker.top,
            color: marker.color,
            opacity: 0.95,
            filter: marker.isHovered ? `drop-shadow(0 0 6px ${marker.color})` : 'none',
            zIndex: marker.isHovered ? 2 : 1,
            '& svg': { fontSize: marker.iconSize },
          }}
        >
          {Icon ? <Icon fontSize="inherit" /> : null}
        </Box>
      );
    })}
  </>
);
