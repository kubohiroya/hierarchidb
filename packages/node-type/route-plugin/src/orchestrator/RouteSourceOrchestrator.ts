import type { DataSourceSpec, OdPair, RouteBatchSpec, StrategyContext, TaskPlan } from './types.js';
import { getRouteDownloadService, notifyAuthRequired } from '../services/download/registry.js';
import { CsvStrategy } from './strategies/CsvStrategy.js';
import { GeoJsonStrategy } from './strategies/GeoJsonStrategy.js';

export interface NetworkPortLike {
  get(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer> }>;
}

export interface OrchestratorDeps {
  net: NetworkPortLike;
}

export class RouteSourceOrchestrator {
  private strategies = [new CsvStrategy(), new GeoJsonStrategy()];

  constructor(private deps: OrchestratorDeps) {
    void this.deps;
  }

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
    const { service, readAll } = await getRouteDownloadService();
    for (const f of plan.fetch) {
      try {
        const fileId = `route-src:${crypto.randomUUID()}`;
        await service.download(f.url, fileId);
        const full = await readAll(fileId);
        blobs.set(f.url, new Blob([full]));
      } catch (e: any) {
        const msg = String(e?.message || e);
        if (/HTTP 401|HTTP 403|Auth required/i.test(msg)) {
          notifyAuthRequired({ resource: f.url, provider: 'datasource', hint: 'Authentication required' });
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
