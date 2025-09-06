import type { NetworkPortLike, RoutingEngine } from './types';

export interface OsrmOptions {
  baseUrl?: string; osrmBaseUrl?: string;
  profile: 'car' | 'bike' | 'foot' | 'truck';
  geometries?: 'geojson' | 'polyline';
  overview?: 'full' | 'simplified' | 'false';
  headers?: Record<string,string>;
}

export class OsrmEngine implements RoutingEngine {
  constructor(private net: NetworkPortLike) {}
  async route(points: [number, number][], options: OsrmOptions) {
    const base = (options?.baseUrl || options?.osrmBaseUrl || '').trim();
    if (!base) throw new Error('OSRM baseUrl is required');
    const profile = options.profile || 'car';
    const coords = points.map(p => `${p[0]},${p[1]}`).join(';');
    const params = new URLSearchParams({ geometries: options.geometries || 'geojson', overview: options.overview || 'full' });
    const url = `${base.replace(/\/$/, '')}/route/v1/${profile}/${coords}?${params.toString()}`;
    const res = await this.net.get(url, { headers: options.headers as any });
    if (res.status === 401 || res.status === 403) {
    try {
      const g: any = globalThis as any;
      // どちらか存在するものを使う
      const reg =
        g?.AuthNotificationRegistry?.getInstance?.() ||
        g?.authNotificationRegistry ||
        g?.authRegistry;
      // onAuthRequired の形に合わせて適宜プロパティ名/内容を調整
      reg?.onAuthRequired?.({
        resource: url,
        provider: 'osrm',
        hint: 'Authorization header required',
      });
    } catch {
      // レジストリが無くてもここで落とさない
    }
    throw new Error(`OSRM auth required: ${res.status}`);
  }
  if (!res.ok) throw new Error(`OSRM request failed: ${res.status}`);

    const text = new TextDecoder().decode(await res.arrayBuffer());
    const json = JSON.parse(text);
    const route = json?.routes?.[0];
    if (!route) throw new Error('OSRM: no route');
    const distance = route.distance as number;
    const duration = route.duration as number | undefined;
    const line = (route.geometry?.coordinates || route.geometry) as [number, number][];
    return { line, distance_m: distance, duration_s: duration };
  }
}

