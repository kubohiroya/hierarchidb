declare module 'geohash' {
  export function encode(latitude: number, longitude: number, precision?: number): string;
  export function decode(hash: string): { latitude: number; longitude: number; error: { latitude: number; longitude: number } };
  export function bounds(hash: string): { minLat: number; minLon: number; maxLat: number; maxLon: number };
  export function neighbors(hash: string): string[];
  export function adjacent(hash: string, direction: 'top' | 'bottom' | 'left' | 'right'): string;
}