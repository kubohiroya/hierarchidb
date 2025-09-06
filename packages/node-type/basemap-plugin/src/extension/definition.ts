/**
 * Compatibility extension definition for tests expecting legacy path
 */
export const BaseMapExtension = {
  extends: 'folder',
  nodeType: 'basemap',
  name: 'BaseMap',
  displayName: 'ベースマップ',
  extendedFields: [
    { name: 'baseMapMetadataId' },
    { name: 'mapStyle' },
    { name: 'viewport' },
    { name: 'displayOptions' },
  ],
  extendedSteps: [
    {
      stepNumber: 2,
      title: 'Map Style',
      validation: {
        async validate(data: any) {
          const errors: string[] = [];
          const style = data?.mapStyle?.style;
          if (!style) errors.push('Map style selection is required');
          if (style === 'custom' && !data?.mapStyle?.customStyleUrl) {
            errors.push('Custom style URL is required when custom style is selected');
          }
          return { isValid: errors.length === 0, errors };
        },
      },
    },
    {
      stepNumber: 3,
      title: 'Map Viewport',
      validation: {
        async validate(data: any) {
          const errors: string[] = [];
          const vp = data?.viewport;
          if (!vp) errors.push('Viewport configuration is required');
          const center = vp?.center;
          if (center) {
            const [lng, lat] = center;
            if (typeof lng !== 'number' || typeof lat !== 'number') {
              errors.push('Valid center coordinates are required');
            } else {
              if (lng < -180 || lng > 180)
                errors.push('Longitude must be a number between -180 and 180');
              if (lat < -90 || lat > 90)
                errors.push('Latitude must be a number between -90 and 90');
            }
          } else if (vp !== undefined) {
            errors.push('Valid center coordinates are required');
          }
          const zoom = vp?.zoom;
          if (zoom !== undefined && (typeof zoom !== 'number' || zoom < 0 || zoom > 24))
            errors.push('Zoom level must be between 0 and 24');
          return { isValid: errors.length === 0, errors };
        },
      },
    },
    {
      stepNumber: 4,
      title: 'Display Options',
      validation: { async validate() { return { isValid: true, errors: [] as string[] }; } },
    },
  ],
  extendedValidation: {
    extendedRules: {
      coordinateRangeRule: {
        validate(data: any) {
          const c = data?.viewport?.center;
          if (!c) return true;
          const [lng, lat] = c;
          return (
            typeof lng === 'number' && typeof lat === 'number' && lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90
          );
        },
      },
      customStyleUrlRule: {
        validate(data: any) {
          const s = data?.mapStyle;
          if (!s || s.style !== 'custom') return true;
          const url = s.customStyleUrl;
          try { new URL(url); return true; } catch { return false; }
        },
      },
    },
  },
};

export type BaseMapEntity = any;
export type BaseMapWorkingCopy = any;
