/**
 * @file colorMapping.ts
 * @description Color mapping utilities for StyleMap plugin
 */

/**
 * Generate color mapping for values based on configuration
 */
export function generateColorMapping(config: any, values: (string | number | null)[]): string[] {
  if (!config || !values || values.length === 0) {
    return [];
  }

  // Filter out null values and convert to numbers where possible
  const numericValues = values
    .filter((v) => v !== null && v !== undefined)
    .map((v) => (typeof v === 'number' ? v : parseFloat(String(v))))
    .filter((v) => !isNaN(v));

  if (numericValues.length === 0) {
    return values.map(() => '#808080'); // Default gray
  }

  const min = Math.min(...numericValues);
  const max = Math.max(...numericValues);
  const range = max - min;

  return values.map((value) => {
    if (value === null || value === undefined) {
      return '#cccccc'; // Light gray for null values
    }

    const numValue = typeof value === 'number' ? value : parseFloat(String(value));
    if (isNaN(numValue)) {
      return '#cccccc'; // Light gray for non-numeric values
    }

    // Normalize value to 0-1 range
    const normalized = range === 0 ? 0.5 : (numValue - min) / range;

    // Generate color using HSL
    const hue =
      config.mapping?.hueStart ??
      0 + normalized * ((config.mapping?.hueEnd ?? 1) - (config.mapping?.hueStart ?? 0));
    const saturation = (config.mapping?.saturation ?? 0.7) * 100;
    const lightness = (config.mapping?.brightness ?? 0.5) * 100;

    return `hsl(${Math.round(hue * 360)}, ${saturation}%, ${lightness}%)`;
  });
}
