import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import type React from 'react';
import type { ResourceLayerMapProps } from '~/components/ResourceLayerMap';
import { ResourceLayerMap } from '~/components/ResourceLayerMap';
import { useMonochromeBasemapStyleUrl } from './useMonochromeBasemapStyleUrl.js';

export type MapPreviewShellProps = {
  mapProps: ResourceLayerMapProps;
  containerRef?: React.Ref<HTMLDivElement>;
  overlay?: React.ReactNode;
  containerSx?: SxProps<Theme>;
};

export const MapPreviewShell: React.FC<MapPreviewShellProps> = ({
  mapProps,
  containerRef,
  overlay,
  containerSx,
}) => {
  const fallbackStyleUrl = useMonochromeBasemapStyleUrl();
  const resolvedMapStyleUrl = mapProps.mapStyleUrl ?? fallbackStyleUrl;
  const resolvedBasemapStyles = mapProps.basemapStyles ?? [];

  const resolvedMapProps =
    'mapStyleObject' in mapProps && mapProps.mapStyleObject
      ? {
          ...mapProps,
          basemapStyles: resolvedBasemapStyles,
        }
      : {
          ...mapProps,
          mapStyleUrl: resolvedMapStyleUrl,
          basemapStyles: resolvedBasemapStyles,
        };

  return (
    <Box
      ref={containerRef}
      flex={1}
      minHeight={0}
      height="100%"
      borderRadius={1}
      overflow="hidden"
      position="relative"
      sx={{ overscrollBehavior: 'contain', p: 0, ...containerSx }}
    >
      <ResourceLayerMap {...resolvedMapProps} />
      {overlay}
    </Box>
  );
};
