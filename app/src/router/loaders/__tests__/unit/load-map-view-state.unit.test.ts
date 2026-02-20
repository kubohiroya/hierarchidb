import { describe, expect, it } from 'vitest';
import { DEFAULT_VIEW_STATE, formatZxyParam, mapLoader, parseZxyParam } from '../../mapLoader.ts';

describe('parseZxyParam', () => {
  it('should return null for null input', () => {
    expect(parseZxyParam(null)).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(parseZxyParam('')).toBeNull();
  });

  it('should return null for invalid format (wrong number of parts)', () => {
    expect(parseZxyParam('3,135')).toBeNull();
    expect(parseZxyParam('3,135,40,extra')).toBeNull();
  });

  it('should parse valid zxy parameter with 3 parts (BUG FIX)', () => {
    // This is the bug that was fixed: parts.length === 3 returned null
    const result = parseZxyParam('3,135,40');
    expect(result).not.toBeNull();
    expect(result).toEqual({
      zoom: 3,
      longitude: 135,
      latitude: 40,
    });
  });

  it('should parse decimal values correctly', () => {
    const result = parseZxyParam('10.5,139.6917,35.6895');
    expect(result).toEqual({
      zoom: 10.5,
      longitude: 139.6917,
      latitude: 35.6895,
    });
  });

  it('should return null for invalid zoom (negative)', () => {
    expect(parseZxyParam('-1,135,40')).toBeNull();
  });

  it('should return null for invalid zoom (> 22)', () => {
    expect(parseZxyParam('23,135,40')).toBeNull();
  });

  it('should return null for invalid longitude (< -180)', () => {
    expect(parseZxyParam('3,-181,40')).toBeNull();
  });

  it('should return null for invalid longitude (> 180)', () => {
    expect(parseZxyParam('3,181,40')).toBeNull();
  });

  it('should return null for invalid latitude (< -90)', () => {
    expect(parseZxyParam('3,135,-91')).toBeNull();
  });

  it('should return null for invalid latitude (> 90)', () => {
    expect(parseZxyParam('3,135,91')).toBeNull();
  });

  it('should return null for non-numeric values', () => {
    expect(parseZxyParam('abc,def,ghi')).toBeNull();
    expect(parseZxyParam('3,abc,40')).toBeNull();
  });

  it('should handle boundary values correctly', () => {
    const result1 = parseZxyParam('0,-180,-90');
    expect(result1).toEqual({ zoom: 0, longitude: -180, latitude: -90 });

    const result2 = parseZxyParam('22,180,90');
    expect(result2).toEqual({ zoom: 22, longitude: 180, latitude: 90 });
  });
});

describe('formatZxyParam', () => {
  it('should format view atoms correctly', () => {
    const result = formatZxyParam({
      zoom: 3,
      longitude: 135,
      latitude: 40,
    });
    expect(result).toBe('3,135,40');
  });

  it('should round zoom to 2 decimal places', () => {
    const result = formatZxyParam({
      zoom: 10.556789,
      longitude: 139.6917,
      latitude: 35.6895,
    });
    expect(result).toBe('10.56,139.6917,35.6895');
  });

  it('should round longitude and latitude to 4 decimal places', () => {
    const result = formatZxyParam({
      zoom: 10,
      longitude: 139.691712345,
      latitude: 35.689512345,
    });
    expect(result).toBe('10,139.6917,35.6895');
  });

  it('should handle integer values', () => {
    const result = formatZxyParam({
      zoom: 5,
      longitude: 140,
      latitude: 36,
    });
    expect(result).toBe('5,140,36');
  });
});

describe('mapLoader', () => {
  it('should return default view atoms when zxy is not provided', () => {
    const result = mapLoader({});
    expect(result).toEqual(DEFAULT_VIEW_STATE);
  });

  it('should return default view atoms when zxy is invalid', () => {
    const result = mapLoader({ zxy: 'invalid' });
    expect(result).toEqual(DEFAULT_VIEW_STATE);
  });

  it('should parse valid zxy from search params', () => {
    const result = mapLoader({ zxy: '3,135,40' });
    expect(result).toEqual({
      zoom: 3,
      longitude: 135,
      latitude: 40,
    });
  });

  it('should handle non-string zxy values', () => {
    const result = mapLoader({ zxy: 123 });
    expect(result).toEqual(DEFAULT_VIEW_STATE);
  });
});
