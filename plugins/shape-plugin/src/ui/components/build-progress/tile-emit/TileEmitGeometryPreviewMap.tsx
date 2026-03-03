import FitScreenSharpIcon from '@mui/icons-material/FitScreenSharp';
import { Box, IconButton } from '@mui/material';
import 'leaflet/dist/leaflet.css';
import type { Feature, Geometry } from 'geojson';
import { useTileEmitGeometryPreviewMap } from './useTileEmitGeometryPreviewMap.js';

export type TileBBox = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type TileEmitGeometryPreviewMapProps = {
  tileBBox: TileBBox;
  bufferBBox: TileBBox;
  features: Feature<Geometry>[];
  selectedFeatureId: string | null;
  hoveredFeatureId: string | null;
  baseColor: string;
  hoverColor: string;
  onMouseLeave?: () => void;
};

export const TileEmitGeometryPreviewMap = ({
  tileBBox,
  bufferBBox,
  features,
  selectedFeatureId,
  hoveredFeatureId,
  baseColor,
  hoverColor,
  onMouseLeave,
}: TileEmitGeometryPreviewMapProps) => {
  const { containerRef, fitToTarget } = useTileEmitGeometryPreviewMap({
    tileBBox,
    bufferBBox,
    features,
    selectedFeatureId,
    hoveredFeatureId,
    baseColor,
    hoverColor,
  });

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minWidth: 200,
        minHeight: 200,
        aspectRatio: '1 / 1',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        overflow: 'hidden',
        bgcolor: 'common.white',
      }}
      onMouseLeave={() => onMouseLeave?.()}
    >
      <IconButton
        size="small"
        aria-label="Fit geometry bounds"
        onClick={() => fitToTarget()}
        sx={{
          position: 'absolute',
          top: 72,
          right: 12,
          zIndex: 1200,
          bgcolor: 'common.white',
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: 1,
          width: 26,
          height: 26,
          p: 0,
          borderRadius: '4px',
          color: 'grey.600',
          '&:hover': {
            bgcolor: 'grey.50',
          },
          '& svg': {
            fontSize: 16,
          },
        }}
      >
        <FitScreenSharpIcon fontSize="inherit" />
      </IconButton>
      <Box
        ref={containerRef}
        sx={{
          width: '100%',
          height: '100%',
          '& .leaflet-container': {
            width: '100%',
            height: '100%',
            background: 'transparent',
          },
          '& .leaflet-control-zoom': {
            transform: 'scale(0.85)',
            transformOrigin: 'top right',
            marginTop: '4px',
            marginRight: '4px',
          },
          '& .leaflet-control-zoom a': {
            width: 20,
            height: 20,
            lineHeight: '20px',
            fontSize: '14px',
          },
        }}
      />
    </Box>
  );
};
