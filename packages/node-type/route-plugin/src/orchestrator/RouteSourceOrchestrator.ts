import type { DataSourceSpec, RouteBatchSpec, StrategyContext, TaskPlan, OdPair } from './types';
import { createRouteDownloadService } from '../services/download/factory';
import { CsvStrategy } from './strategies/CsvStrategy';
import { GeoJsonStrategy } from './strategies/GeoJsonStrategy';

export interface NetworkPortLike { get(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer> }> }

export interface OrchestratorDeps { net: NetworkPortLike }

export class RouteSourceOrchestrator {
  private strategies = [new CsvStrategy(), new GeoJsonStrategy()];
  constructor(private deps: OrchestratorDeps) { void this.deps; }

  async plan(spec: RouteBatchSpec): Promise<TaskPlan> {
    const planId = crypto.randomUUID();
    const ctx: StrategyContext = { planId };
    const aggregate: TaskPlan = { fetch: [], parse: [] };
    for (const s of spec.sources) {
      const strat = this.pickStrategy(s);
      const p = await strat.plan(s, ctx);
      aggregate.fetch.push(...p.fetch);
      aggregate.parse.push(...p.parse);
    }
    return aggregate;
  }

  async preview(spec: RouteBatchSpec): Promise<{ odPairs: OdPair[]; plan: TaskPlan }> {
    const plan = await this.plan(spec);
    const blobs = new Map<string, Blob>();
    const { service, readAll } = await createRouteDownloadService();
    for (const f of plan.fetch) {
      try {
        const fileId = `route-src:${crypto.randomUUID()}`;
        await service.download(f.url, fileId);
        const full = await readAll(fileId);
        blobs.set(f.url, new Blob([full]));
      } catch (e: any) {
        // Translate auth errors to AuthRecovery notification if needed
        const msg = String(e?.message || e);
        if (/HTTP 401|HTTP 403|Auth required/i.test(msg)) {
          try {
            const g: any = globalThis as any;
            const reg = g?.AuthNotificationRegistry?.getInstance?.() || g?.authNotificationRegistry || g?.authRegistry;
            reg?.onAuthRequired?.({ resource: f.url, provider: 'datasource', hint: 'Authentication required' });
          } catch {}
        }
        throw e;
      }
    }
    for (const src of spec.sources) {
      if (src.inline && !src.url) {
        const ref = plan.parse.find(p => p.source === src.type)?.payloadRef ?? crypto.randomUUID();
        blobs.set(ref, new Blob([src.inline]));
      }
    }
    const out: OdPair[] = [];
    for (const t of plan.parse) {
      const strat = this.strategyForParse(t.source);
      const items = await strat.executeParse(t, blobs, spec.defaults);
      out.push(...items);
    }
    return { odPairs: out, plan };
  }

  private pickStrategy(spec: DataSourceSpec) {
    const s = this.strategies.find((st) => st.supports(spec));
    if (!s) throw new Error(`No strategy for ${spec.type}`);
    return s;
  }
  private strategyForParse(source: string) {
    const s = this.strategies.find((st) => (st as any).supports({ type: source } as any));
    if (!s) throw new Error(`No parse strategy for ${source}`);
    return s as any;
  }
}
