import type { DataSourceSpec, RouteBatchSpec, StrategyContext, TaskPlan, OdPair } from './types';
import { CsvStrategy } from './strategies/CsvStrategy';
import { GeoJsonStrategy } from './strategies/GeoJsonStrategy';

export interface NetworkPortLike { get(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer> }> }

export interface OrchestratorDeps { net: NetworkPortLike }

export class RouteSourceOrchestrator {
  private strategies = [new CsvStrategy(), new GeoJsonStrategy()];
  constructor(private deps: OrchestratorDeps) {}

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
    for (const f of plan.fetch) {
      const res = await this.deps.net.get(f.url, f.opts);
      if (!res.ok) throw new Error(`Fetch failed ${f.url}: ${res.status}`);
      blobs.set(f.url, new Blob([await res.arrayBuffer()]));
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

