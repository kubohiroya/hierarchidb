import type { RoutingEngine } from './types';

export class SearouteEngine implements RoutingEngine {
  async route(points: [number, number][], _options: any) {
    const [a, b] = [points[0]!, points[points.length - 1]!];
    const distance_m = haversine(a[1], a[0], b[1], b[0]);
    return { line: [a, b] as [number, number][], distance_m };
  }
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const s1 = Math.sin(dLat / 2), s2 = Math.sin(dLon / 2);
  const a = s1 * s1 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * s2 * s2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

