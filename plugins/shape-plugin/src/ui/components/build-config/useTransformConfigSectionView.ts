import { useTranslation } from '../../i18n.js';
import { useTransformConfigSection } from './useTransformConfigSection.ts';
import type { ShapeBuildConfig } from '../../../common/types/index.js';
import { getBuildConfigHoverCardSx } from '@hierarchidb/ui-accordion-config';

const EARTH_RADIUS = 6378137;
const MVT_EXTENT = 4096;
const MAX_MERCATOR_LAT = 85.05112878;

type Bbox = {
  name: string;
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
};

const COUNTRY_BBOXES: Bbox[] = [
  { name: 'Russia', minLon: 19, minLat: 41, maxLon: 180, maxLat: 82 },
  { name: 'Canada', minLon: -141, minLat: 42, maxLon: -52, maxLat: 83 },
  { name: 'China', minLon: 73, minLat: 18, maxLon: 135, maxLat: 54 },
  { name: 'Australia', minLon: 113, minLat: -44, maxLon: 154, maxLat: -10 },
  { name: 'Greenland', minLon: -73, minLat: 59, maxLon: -12, maxLat: 83 },
  { name: 'India', minLon: 68, minLat: 6, maxLon: 97, maxLat: 35 },
];

const metersPerPixel = (z: number): number => (
  (2 * Math.PI * EARTH_RADIUS) / (MVT_EXTENT * Math.pow(2, z))
);

const lonLatToMercator = (lon: number, lat: number): [number, number] => {
  const clampedLat = Math.min(MAX_MERCATOR_LAT, Math.max(-MAX_MERCATOR_LAT, lat));
  const x = (lon * Math.PI * EARTH_RADIUS) / 180;
  const y = EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + (clampedLat * Math.PI) / 360));
  return [x, y];
};

const computeBboxAreaPx2 = (bbox: Bbox, zTarget: number): number => {
  const [minX, minY] = lonLatToMercator(bbox.minLon, bbox.minLat);
  const [maxX, maxY] = lonLatToMercator(bbox.maxLon, bbox.maxLat);
  const width = Math.max(0, maxX - minX);
  const height = Math.max(0, maxY - minY);
  const areaMeters2 = width * height;
  if (!Number.isFinite(areaMeters2) || areaMeters2 <= 0) return 0;
  const mpp = metersPerPixel(zTarget);
  if (!Number.isFinite(mpp) || mpp <= 0) return 0;
  const areaPx2 = areaMeters2 / (mpp * mpp);
  return Number.isFinite(areaPx2) ? areaPx2 : 0;
};

const formatPx2 = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return '0';
  if (value >= 1e9) {
    return `${(value / 1e9).toFixed(2)}e9`;
  }
  if (value >= 1e6) {
    return `${(value / 1e6).toFixed(2)}e6`;
  }
  return new Intl.NumberFormat('en-US').format(Math.round(value));
};

export const useTransformConfigSectionView = ({
  config,
  disabled,
  onChange,
}: {
  config: ShapeBuildConfig;
  disabled?: boolean;
  onChange: (next: ShapeBuildConfig) => void;
}) => {
  const { t } = useTranslation();
  const { baseTransformConfig, update } = useTransformConfigSection({ config, onChange });

  const toleranceExpMin = Math.log2(0.005);
  const toleranceExpMax = 0;
  const toExponent = (value: number): number => {
    if (!Number.isFinite(value) || value <= 0) return toleranceExpMin;
    const exponent = Math.log2(value);
    return Math.min(toleranceExpMax, Math.max(toleranceExpMin, exponent));
  };
  const toTolerance = (exponent: number): number => Math.pow(2, exponent);
  const formatTolerance = (value: number): string => {
    const rounded = Number(value.toFixed(4));
    return String(rounded);
  };
  const toleranceMarks = [toleranceExpMin, -6, -4, -2, toleranceExpMax]
    .filter((value, index, array) => array.indexOf(value) === index)
    .map((value) => ({ value, label: formatTolerance(toTolerance(value)) }));

  const areaBasedTolerance = baseTransformConfig.areaBasedTolerance;
  const zoomBandBoundaries = baseTransformConfig.zoomBandBoundaries;
  const zTarget = zoomBandBoundaries[1] ?? zoomBandBoundaries[0] ?? 0;
  const thresholdAreaExponent = Math.log10(
    Math.max(1, areaBasedTolerance.thresholdAreaPx2)
  );
  const thresholdAreaMarks = COUNTRY_BBOXES.map((bbox) => {
    const areaPx2 = computeBboxAreaPx2(bbox, zTarget);
    return {
      value: Math.log10(Math.max(1, areaPx2)),
      label: bbox.name,
    };
  });
  const markValues = thresholdAreaMarks.map((mark) => mark.value);
  const thresholdAreaRange = {
    min: Math.floor(Math.min(thresholdAreaExponent, ...markValues) - 0.5),
    max: Math.ceil(Math.max(thresholdAreaExponent, ...markValues) + 0.5),
  };
  const hoverCardSx = getBuildConfigHoverCardSx(disabled);

  const handleTransformWorkersChange = (maxConcurrent: number) => {
    update({
      transformConfig: {
        ...baseTransformConfig,
        maxConcurrent,
      },
    });
  };

  const handleThresholdAreaChange = (value: number | number[]) => {
    if (Array.isArray(value)) return;
    const nextArea = Math.pow(10, value);
    if (!Number.isFinite(nextArea)) return;
    update({
      transformConfig: {
        ...baseTransformConfig,
        areaBasedTolerance: {
          ...areaBasedTolerance,
          thresholdAreaPx2: nextArea,
        },
      },
    });
  };

  const handleToleranceChange = (tolerance: number) => {
    const nextLargeAreaTolerance = Math.min(
      areaBasedTolerance.largeAreaTolerance,
      tolerance,
    );
    update({
      transformConfig: {
        ...baseTransformConfig,
        tolerance,
        areaBasedTolerance: {
          ...areaBasedTolerance,
          largeAreaTolerance: nextLargeAreaTolerance,
        },
      },
    });
  };

  const handleLargeAreaToleranceChange = (value: number | number[]) => {
    if (Array.isArray(value)) return;
    const nextTolerance = toTolerance(value);
    const clamped = Math.min(nextTolerance, baseTransformConfig.tolerance);
    update({
      transformConfig: {
        ...baseTransformConfig,
        areaBasedTolerance: {
          ...areaBasedTolerance,
          largeAreaTolerance: clamped,
        },
      },
    });
  };

  return {
    t,
    baseTransformConfig,
    areaBasedTolerance,
    toleranceExpMin,
    toleranceExpMax,
    toleranceMarks,
    zTarget,
    thresholdAreaExponent,
    thresholdAreaMarks,
    thresholdAreaRange,
    hoverCardSx,
    toExponent,
    toTolerance,
    formatTolerance,
    formatPx2,
    handleTransformWorkersChange,
    handleThresholdAreaChange,
    handleToleranceChange,
    handleLargeAreaToleranceChange,
  };
};
