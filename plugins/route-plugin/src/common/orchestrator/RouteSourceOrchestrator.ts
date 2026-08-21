import {
  FetchNetworkPort,
  getCorsProxyBaseURL,
  notifyPluginAuthRequired,
} from '@hierarchidb/download';
import { GeoJsonStrategy } from './strategies/GeoJsonStrategy.js';
import { TabularStrategy } from './strategies/TabularStrategy.js';
import type {
  DataSourceSpec,
  DataSourceStrategy,
  OdPair,
  ParseTask,
  RouteBuildSpec,
  StrategyContext,
  TaskPlan,
} from './types.js';

export class RouteSourceOrchestrator {
  private readonly strategies: DataSourceStrategy[] = [
    new TabularStrategy(),
    new GeoJsonStrategy(),
  ];
  private net: FetchNetworkPort | null = null;

  async plan(spec: RouteBuildSpec): Promise<TaskPlan> {
    const planId = crypto.randomUUID();
    const ctx: StrategyContext = { planId };
    const aggregate: TaskPlan = { source: [], parse: [] };
    for (const s of spec.sources) {
      const strat = this.pickStrategy(s);
      const p = await strat.plan(s, ctx);
      aggregate.source.push(...p.source);
      aggregate.parse.push(...p.parse);
    }
    return aggregate;
  }

  async preview(spec: RouteBuildSpec): Promise<{ odPairs: OdPair[]; plan: TaskPlan }> {
    const plan = await this.plan(spec);
    const blobs = new Map<string, Blob>();
    const net = this.getNetworkPort();
    for (const f of plan.source) {
      try {
        const response = await net.get(f.url);
        if (response.status === 401 || response.status === 403) {
          throw new Error(`Auth required: ${response.status}`);
        }
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const full = await response.arrayBuffer();
        blobs.set(f.url, new Blob([full]));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/HTTP 401|HTTP 403|Auth required/i.test(message)) {
          notifyPluginAuthRequired('route', {
            resource: f.url,
            provider: 'datasource',
            hint: 'Authentication required',
          });
        }
        throw error;
      }
    }
    for (const src of spec.sources) {
      if (src.inline && !src.url) {
        const ref =
          plan.parse.find((p) => p.source === src.type)?.payloadRef ?? crypto.randomUUID();
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

  private getNetworkPort(): FetchNetworkPort {
    if (this.net) return this.net;
    const corsProxyBaseURL = getCorsProxyBaseURL() || undefined;
    this.net = new FetchNetworkPort({
      perHostConcurrency: 4,
      corsProxyBaseURL,
      auth: { scope: 'route' },
    });
    return this.net;
  }
}
