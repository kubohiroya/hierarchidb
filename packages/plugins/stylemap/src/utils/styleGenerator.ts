/**
 * @file styleGenerator.ts
 * @description Style generation utilities for StyleMap plugin
 */

/**
 * Generate MapLibre style from StyleMap configuration
 */
export function generateMapLibreStyle(
  styleMapConfig: any,
  keyValuePairs: { keyValue: string | number; styleValue: any }[]
): any {
  if (!styleMapConfig || !keyValuePairs || keyValuePairs.length === 0) {
    return {};
  }

  // Generate a basic MapLibre style object
  const style = {
    version: 8,
    sources: {},
    layers: [],
  };

  // This is a simplified implementation
  // In a real application, this would generate proper MapLibre style expressions
  return style;
}

/**
 * Generate CSS styles from StyleMap configuration
 */
export function generateCSSStyles(
  keyValuePairs: { keyValue: string | number; styleValue: any }[]
): Record<string, string> {
  const styles: Record<string, string> = {};

  keyValuePairs.forEach(({ keyValue, styleValue }) => {
    styles[String(keyValue)] = String(styleValue);
  });

  return styles;
}
