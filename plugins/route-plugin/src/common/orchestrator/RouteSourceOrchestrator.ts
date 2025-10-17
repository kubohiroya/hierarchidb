import type { DataSourceSpec, DataSourceStrategy, OdPair, ParseTask, RouteBatchSpec, StrategyContext, TaskPlan } from './types.js';
import type { NetworkPortLike } from '../../services/createRouteBatchManager.js';
import { getRouteDownloadService, notifyAuthRequired } from '../../services/download/registry.js';
import { CsvStrategy } from './strategies/CsvStrategy.js';
import { GeoJsonStrategy } from './strategies/GeoJsonStrategy.js';

export interface OrchestratorDeps {
  net: NetworkPortLike;
}

export class RouteSourceOrchestrator {
  private readonly strategies: DataSourceStrategy[] = [new CsvStrategy(), new GeoJsonStrategy()];

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
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/HTTP 401|HTTP 403|Auth required/i.test(message)) {
          notifyAuthRequired({ resource: f.url, provider: 'datasource', hint: 'Authentication required' });
        }
        throw error;
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
    const strategy = this.strategies.find((candidate) => candidate.supports(spec));
    if (!strategy) throw new Error(`No strategy for ${spec.type}`);
    return strategy;
  }

  private strategyForParse(source: ParseTask['source']): DataSourceStrategy {
    const stub: DataSourceSpec = { type: source };
    const strategy = this.strategies.find((candidate) => candidate.supports(stub));
    if (!strategy) throw new Error(`No parse strategy for ${source}`);
    return strategy;
  }
}
