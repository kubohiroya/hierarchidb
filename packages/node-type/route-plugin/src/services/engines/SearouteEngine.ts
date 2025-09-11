import type { RoutingEngine } from './types';

type SeaRouteLike =
  | { getSeaRoute: (from: [number, number], to: [number, number], options?: any) => Promise<any> }
  | ((from: [number, number], to: [number, number], options?: any) => Promise<any>)
  | { default: (from: [number, number], to: [number, number], options?: any) => Promise<any> };

export class SearouteEngine implements RoutingEngine {
  private libPromise?: Promise<SeaRouteLike | undefined>;

  async route(points: [number, number][], options?: any) {
    const start = points[0]!;
    const end = points[points.length - 1]!;

    const featureEnabled =
      // Vite client-side env: must use import.meta.env with VITE_ prefix
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_WORKER_FEATURE_ROUTE_SEAROUTE === '1') ||
      (typeof process !== 'undefined' && (process as any)?.env?.WORKER_FEATURE_ROUTE_SEAROUTE === '1') ||
      (typeof globalThis !== 'undefined' && (globalThis as any)?.FEATURE_FLAGS?.ROUTE_SEAROUTE === true);

    if (featureEnabled) {
      try {
        const lib = await this.loadLib();
        if (lib) {
          const fn = this.resolveApi(lib);
          if (!fn) throw new Error('Unsupported searoute-js API shape');

          const srOptions = this.mapOptions(options);
          let result: any;
          try {
            result = await fn([start[0], start[1]], [end[0], end[1]], srOptions);
          } catch (err: any) {
            // Some variants (johnx25bd/searoute-js) expect the 3rd arg to be a units string
            const msg = String(err?.message || err || '');
            const unitsStr = this.unitsString(options);
            if (unitsStr && /units/i.test(msg)) {
              result = await fn([start[0], start[1]], [end[0], end[1]], unitsStr);
            } else {
              throw err;
            }
          }

          const line = this.extractLine(result);
          const distance_m = this.extractDistanceMeters(result, line);
          const duration_s = this.estimateDuration(distance_m, options);
          return { line, distance_m, duration_s } as const;
        }
      } catch (e: any) {
        // Fall through to GC fallback with a warning
        try {
          console.warn?.(`searoute-js unavailable, fallback to great-circle: ${e?.message ?? e}`);
        } catch {
        }
      }
    }

    // Fallback: straight great-circle approximation between endpoints
    const distance_m = haversine(start[1], start[0], end[1], end[0]);
    return { line: [start, end] as [number, number][], distance_m };
  }

  private async loadLib(): Promise<SeaRouteLike | undefined> {
    if (!this.libPromise) {
      this.libPromise = (async () => {
        // Avoid bundler resolution: compute module names at runtime and use @vite-ignore
        const tryLoad = async (name: string) => {
          try {
            const mod = await import(/* @vite-ignore */ name);
            return mod as any;
          } catch {
            return undefined;
          }
        };

        // Prefer explicit override via env/flag
        const forced =
          (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_ROUTE_SEAROUTE_PKG) ||
          (typeof process !== 'undefined' && (process as any)?.env?.ROUTE_SEAROUTE_PKG) ||
          (typeof globalThis !== 'undefined' && (globalThis as any)?.ROUTE_SEAROUTE_PKG) ||
          undefined;

        if (forced) {
          const m = await tryLoad(String(forced));
          if (m) return m;
        }

        // Try well-known names in order
        const names = ['searoute', 'searoute-js'];
        for (const n of names) {
          const m = await tryLoad(n);
          if (m) return m;
        }
        return undefined;
      })();
    }
    return this.libPromise;
  }

  private resolveApi(mod: SeaRouteLike): ((a: [number, number], b: [number, number], o?: any) => Promise<any>) | undefined {
    if (!mod) return undefined;
    if (typeof (mod as any).getSeaRoute === 'function') return (mod as any).getSeaRoute.bind(mod);
    if (typeof (mod as any) === 'function') return mod as any;
    if (typeof (mod as any).default === 'function') return (mod as any).default as any;
    return undefined;
  }

  private mapOptions(options?: any): any {
    if (!options) return undefined;
    const out: any = {};
    if (options.units) out.units = options.units; // 'km' | 'miles' | 'nauticalmiles'
    if (options.blockedAreas) out.blocked = options.blockedAreas;
    if (options.avoidCanals !== undefined) out.avoidCanals = !!options.avoidCanals;
    // Pass through any additional options as-is
    for (const k of Object.keys(options)) if (!(k in out)) out[k] = (options as any)[k];
    return out;
  }

  private extractLine(result: any): [number, number][] {
    // Expect GeoJSON-like { geometry: { type: 'LineString', coordinates: [[lon,lat], ...] } }
    const coords: [number, number][] | undefined =
      result?.geometry?.coordinates || result?.coordinates || result?.line || undefined;
    if (Array.isArray(coords) && coords.length >= 2) return coords as [number, number][];
    throw new Error('searoute-js returned no coordinates');
  }

  private extractDistanceMeters(result: any, line: [number, number][]): number {
    let distance_m: number | undefined;
    const props = result?.properties || result?.props || undefined;
    const dRaw = props?.distance ?? props?.length;
    if (dRaw != null) {
      const units: string | undefined = props?.units || props?.unit || result?.units || undefined;
      const d = Number(dRaw);
      if (Number.isFinite(d)) {
        switch ((units || '').toLowerCase()) {
          case 'm':
          case 'meter':
          case 'meters':
            distance_m = d;
            break;
          case 'km':
          case 'kilometer':
          case 'kilometers':
            distance_m = d * 1000;
            break;
          case 'mile':
          case 'miles':
          case 'mi':
            distance_m = d * 1609.344;
            break;
          case 'nm':
          case 'nauticalmile':
          case 'nauticalmiles':
            distance_m = d * 1852;
            break;
          default:
            // Unknown units; fall back to geometry-based calculation
            break;
        }
      }
    }
    if (distance_m == null) distance_m = this.distanceFromLine(line);
    return distance_m;
  }

  private estimateDuration(distance_m: number, options?: any): number | undefined {
    // If vessel speed is provided, estimate duration.
    const speed_knots = options?.vesselSpeedKnots ?? options?.vesselSpeed ?? options?.speed_knots;
    if (speed_knots && Number.isFinite(Number(speed_knots))) {
      const dist_nm = distance_m / 1852;
      const hours = dist_nm / Number(speed_knots);
      return hours * 3600;
    }
    return undefined;
  }

  private unitsString(options?: any): 'nm' | 'kilometers' | 'miles' | undefined {
    const u = (options?.units || options?.unit || '').toString().toLowerCase();
    switch (u) {
      case 'nm':
      case 'nauticalmile':
      case 'nauticalmiles':
      case 'knots':
        return 'nm';
      case 'km':
      case 'kilometer':
      case 'kilometers':
        return 'kilometers';
      case 'mile':
      case 'miles':
      case 'mi':
        return 'miles';
      default:
        return undefined;
    }
  }

  private distanceFromLine(line: [number, number][]): number {
    let sum = 0;
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i]!;
      const b = line[i + 1]!;
      sum += haversine(a[1], a[0], b[1], b[0]);
    }
    return sum;
  }
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const s1 = Math.sin(dLat / 2), s2 = Math.sin(dLon / 2);
  const a = s1 * s1 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * s2 * s2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
