/**
  * @file colorUtils.test.ts
 * @description Color utilities unit tests
 * :
 * :
 * :
  */

import { describe, expect, it } from 'vitest';
import {
  adjustBrightness,
  calculateLinearColor,
  generateColorGradient,
  getContrastRatio,
  hexToRgb,
  hsvToRgb,
  rgbToHex,
  rgbToHsv,
  valueToColor,
} from '../utils/colorUtils';
import { StylerConfigDefault } from '../types/stylerTypes';

describe('Color Utils', () => {
  describe('HSV/RGB Conversion', () => {
    it('should convert HSV to RGB correctly', () => {
      // Red: H=0, S=1, V=1 -> RGB(255, 0, 0)
      expect(hsvToRgb(0, 1, 1)).toEqual([255, 0, 0]);

      // Green: H=120, S=1, V=1 -> RGB(0, 255, 0)
      expect(hsvToRgb(120, 1, 1)).toEqual([0, 255, 0]);

      // Blue: H=240, S=1, V=1 -> RGB(0, 0, 255)
      expect(hsvToRgb(240, 1, 1)).toEqual([0, 0, 255]);

      // Gray: H=0, S=0, V=0.5 -> RGB(128, 128, 128)
      expect(hsvToRgb(0, 0, 0.5)).toEqual([128, 128, 128]);
    });

    it('should convert RGB to HSV correctly', () => {
      // Red: RGB(255, 0, 0) -> HSV(0, 1, 1)
      const [h1, s1, v1] = rgbToHsv(255, 0, 0);
      expect(h1).toBeCloseTo(0, 1);
      expect(s1).toBeCloseTo(1, 2);
      expect(v1).toBeCloseTo(1, 2);

      // Green: RGB(0, 255, 0) -> HSV(120, 1, 1)
      const [h2, s2, v2] = rgbToHsv(0, 255, 0);
      expect(h2).toBeCloseTo(120, 1);
      expect(s2).toBeCloseTo(1, 2);
      expect(v2).toBeCloseTo(1, 2);

      // Gray: RGB(128, 128, 128) -> HSV(0, 0, 0.5)
      const [h3, s3, v3] = rgbToHsv(128, 128, 128);
      expect(s3).toBeCloseTo(0, 2);
      expect(v3).toBeCloseTo(0.5, 2);
    });

    it('should have round-trip consistency HSV->RGB->HSV', () => {
      const testCases = [
        [0, 1, 1],      // Red
        [120, 1, 1],    // Green
        [240, 1, 1],    // Blue
        [60, 0.5, 0.8], // Yellow-ish
        [300, 0.7, 0.9], // Magenta-ish
      ];

      testCases.forEach(([h, s, v]) => {
        const [r, g, b] = hsvToRgb(h, s, v);
        const [h2, s2, v2] = rgbToHsv(r, g, b);

        expect(h2).toBeCloseTo(h, 1);
        expect(s2).toBeCloseTo(s, 2);
        expect(v2).toBeCloseTo(v, 2);
      });
    });
  });

  describe('Hex/RGB Conversion', () => {
    it('should convert RGB to hex correctly', () => {
      expect(rgbToHex(255, 0, 0)).toBe('#ff0000');
      expect(rgbToHex(0, 255, 0)).toBe('#00ff00');
      expect(rgbToHex(0, 0, 255)).toBe('#0000ff');
      expect(rgbToHex(128, 128, 128)).toBe('#808080');
      expect(rgbToHex(255, 255, 255)).toBe('#ffffff');
      expect(rgbToHex(0, 0, 0)).toBe('#000000');
    });

    it('should convert hex to RGB correctly', () => {
      expect(hexToRgb('#ff0000')).toEqual([255, 0, 0]);
      expect(hexToRgb('#00ff00')).toEqual([0, 255, 0]);
      expect(hexToRgb('#0000ff')).toEqual([0, 0, 255]);
      expect(hexToRgb('#808080')).toEqual([128, 128, 128]);
      expect(hexToRgb('#ffffff')).toEqual([255, 255, 255]);
      expect(hexToRgb('#000000')).toEqual([0, 0, 0]);
    });

    it('should handle 3-digit hex codes', () => {
      expect(hexToRgb('#f00')).toEqual([255, 0, 0]);
      expect(hexToRgb('#0f0')).toEqual([0, 255, 0]);
      expect(hexToRgb('#00f')).toEqual([0, 0, 255]);
      expect(hexToRgb('#fff')).toEqual([255, 255, 255]);
    });

    it('should have round-trip consistency RGB->Hex->RGB', () => {
      const testCases = [
        [255, 0, 0],
        [0, 255, 0],
        [0, 0, 255],
        [128, 64, 192],
        [200, 150, 100],
      ];

      testCases.forEach(([r, g, b]) => {
        const hex = rgbToHex(r, g, b);
        const [r2, g2, b2] = hexToRgb(hex);

        expect(r2).toBe(r);
        expect(g2).toBe(g);
        expect(b2).toBe(b);
      });
    });
  });

  describe('Linear Color Calculation', () => {
    it('should calculate linear colors in HSV space', () => {
      const config = {
        ...StylerConfigDefault,
        colorSpace: 'hsv' as const,
        mapping: {
          min: 0,
          max: 100,
          hueStart: 0,   // Red
          hueEnd: 120,   // Green
          saturation: 1,
          brightness: 1,
        },
      };

      // Min value should be red-ish
      const minResult = calculateLinearColor(0, config);
      expect(minResult.color).toMatch(/^#[a-f0-9]{6}$/i);

      // Max value should be green-ish
      const maxResult = calculateLinearColor(100, config);
      expect(maxResult.color).toMatch(/^#[a-f0-9]{6}$/i);

      // Mid value should be yellow-ish
      const midResult = calculateLinearColor(50, config);
      expect(midResult.color).toMatch(/^#[a-f0-9]{6}$/i);

      // Colors should be different
      expect(minResult.color).not.toBe(maxResult.color);
      expect(minResult.color).not.toBe(midResult.color);
      expect(maxResult.color).not.toBe(midResult.color);
    });

    it('should calculate linear colors in RGB space', () => {
      const config = {
        ...StylerConfigDefault,
        colorSpace: 'rgb' as const,
        mapping: {
          min: 0,
          max: 100,
          startColor: '#ff0000', // Red
          endColor: '#00ff00',   // Green
          hueStart: 0,
          hueEnd: 120,
          saturation: 1,
          brightness: 1,
        },
      };

      const minResult = calculateLinearColor(0, config);
      const maxResult = calculateLinearColor(100, config);
      const midResult = calculateLinearColor(50, config);

      // Should return valid hex colors
      expect(minResult.color).toMatch(/^#[a-f0-9]{6}$/i);
      expect(maxResult.color).toMatch(/^#[a-f0-9]{6}$/i);
      expect(midResult.color).toMatch(/^#[a-f0-9]{6}$/i);

      // Should have RGB metadata
      expect(minResult.metadata?.r).toBeDefined();
      expect(minResult.metadata?.g).toBeDefined();
      expect(minResult.metadata?.b).toBeDefined();
    });

    it('should handle edge cases', () => {
      const config = {
        ...StylerConfigDefault,
        mapping: {
          min: 10,
          max: 10, // Same min/max
          hueStart: 0,
          hueEnd: 120,
          saturation: 1,
          brightness: 1,
        },
      };

      // Same min/max should not crash
      const result = calculateLinearColor(10, config);
      expect(result.color).toMatch(/^#[a-f0-9]{6}$/i);

      // Out-of-range values should be clamped
      const belowResult = calculateLinearColor(-10, config);
      const aboveResult = calculateLinearColor(50, config);

      expect(belowResult.color).toMatch(/^#[a-f0-9]{6}$/i);
      expect(aboveResult.color).toMatch(/^#[a-f0-9]{6}$/i);
    });
  });

  describe('Value to Color', () => {
    it('should handle null/undefined values', () => {
      const config = StylerConfigDefault;

      const nullResult = valueToColor(null, config);
      const undefinedResult = valueToColor(undefined, config);

      expect(nullResult.color).toBe('#cccccc');
      expect(nullResult.opacity).toBe(0.5);
      expect(undefinedResult.color).toBe('#cccccc');
      expect(undefinedResult.opacity).toBe(0.5);
    });

    it('should use linear algorithm by default', () => {
      const config = {
        ...StylerConfigDefault,
        algorithm: 'linear' as const,
      };

      const result = valueToColor(50, config);
      expect(result.color).toMatch(/^#[a-f0-9]{6}$/i);
      expect(result.opacity).toBeDefined();
    });
  });

  describe('Color Gradient Generation', () => {
    it('should generate valid CSS gradient string', () => {
      const config = StylerConfigDefault;
      const gradient = generateColorGradient(config, 5);

      expect(gradient).toMatch(/^linear-gradient\(to right, #[a-f0-9]{6}(, #[a-f0-9]{6})*\)$/i);

      // Should contain 5 colors
      const matches = gradient.match(/#[a-f0-9]{6}/gi);
      expect(matches).toHaveLength(5);
    });

    it('should create smooth gradient transitions', () => {
      const config = {
        ...StylerConfigDefault,
        mapping: {
          min: 0,
          max: 100,
          hueStart: 0,
          hueEnd: 240,
          saturation: 1,
          brightness: 1,
        },
      };

      const gradient = generateColorGradient(config, 10);
      const colors = gradient.match(/#[a-f0-9]{6}/gi) || [];

      expect(colors).toHaveLength(10);
      // First and last colors should be different
      expect(colors[0]).not.toBe(colors[9]);
    });
  });

  describe('Brightness Adjustment', () => {
    it('should adjust brightness correctly', () => {
      const originalColor = '#808080'; // Gray

      const brighter = adjustBrightness(originalColor, 1.5);
      const darker = adjustBrightness(originalColor, 0.5);
      const unchanged = adjustBrightness(originalColor, 1.0);

      expect(brighter).toMatch(/^#[a-f0-9]{6}$/i);
      expect(darker).toMatch(/^#[a-f0-9]{6}$/i);
      expect(unchanged).toBe('#808080');

      // Brighter should be different from original
      expect(brighter).not.toBe(originalColor);
      expect(darker).not.toBe(originalColor);
    });

    it('should clamp brightness values', () => {
      const white = '#ffffff';
      const black = '#000000';

      // Should not crash with extreme values
      const extremeBright = adjustBrightness(white, 10);
      const extremeDark = adjustBrightness(black, 0.01);

      expect(extremeBright).toMatch(/^#[a-f0-9]{6}$/i);
      expect(extremeDark).toMatch(/^#[a-f0-9]{6}$/i);
    });
  });

  describe('Contrast Ratio', () => {
    it('should calculate contrast ratios correctly', () => {
      // Black vs White should have maximum contrast
      const blackWhite = getContrastRatio('#000000', '#ffffff');
      expect(blackWhite).toBeCloseTo(21, 0); // WCAG max contrast ratio

      // Same colors should have minimum contrast
      const sameColor = getContrastRatio('#808080', '#808080');
      expect(sameColor).toBeCloseTo(1, 0);

      // Red vs Green should have some contrast
      const redGreen = getContrastRatio('#ff0000', '#00ff00');
      expect(redGreen).toBeGreaterThan(1);
      expect(redGreen).toBeLessThan(21);
    });

    it('should be symmetric', () => {
      const color1 = '#ff0000';
      const color2 = '#0000ff';

      const ratio1 = getContrastRatio(color1, color2);
      const ratio2 = getContrastRatio(color2, color1);

      expect(ratio1).toBeCloseTo(ratio2, 2);
    });
  });
});