import type { DataSourceSpec, DataSourceStrategy, OdPair, ParseTask, RouteBatchSpec, StrategyContext, TaskPlan } from '../types.js';
import { normalizeEngine, normalizeMode, toFiniteNumber } from './strategy-utils.js';

export class TabularStrategy implements DataSourceStrategy {
  supports(spec: DataSourceSpec): boolean {
    return spec.type === 'csv';
  }

  async plan(spec: DataSourceSpec, ctx: StrategyContext): Promise<TaskPlan> {
    const id = `${ctx.planId}:csv:0`;
    if (spec.inline && !spec.url) return { fetch: [], parse: [{ kind: 'parse', source: 'csv', payloadRef: id }] };
    if (!spec.url) throw new Error('Tabular strategy requires url or inline');
    return {
      fetch: [{ kind: 'fetch', url: spec.url }],
      parse: [{ kind: 'parse', source: 'csv', payloadRef: spec.url }],
    };
  }

  async executeParse(task: ParseTask, blobs: Map<string, Blob>, defaults?: RouteBatchSpec['defaults']): Promise<OdPair[]> {
    const blob = blobs.get(task.payloadRef);
    if (!blob) throw new Error(`Missing payload for ${task.payloadRef}`);
    const text = await blob.text();
    return parseTabularToOds(text, defaults);
  }
}

function parseTabularToOds(csv: string, defaults?: RouteBatchSpec['defaults']): OdPair[] {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const header = lines[0]!.split(',').map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const lon1 = idx('lon1');
  const lat1 = idx('lat1');
  const lon2 = idx('lon2');
  const lat2 = idx('lat2');
  const modeIdx = idx('mode');
  const engineIdx = idx('engine');
  if (lon1 < 0 || lat1 < 0 || lon2 < 0 || lat2 < 0) throw new Error('Tabular must include lon1,lat1,lon2,lat2 columns');
  const out: OdPair[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitTabularLine(lines[i]!);
    const startLon = toFiniteNumber(cols[lon1]);
    const startLat = toFiniteNumber(cols[lat1]);
    const endLon = toFiniteNumber(cols[lon2]);
    const endLat = toFiniteNumber(cols[lat2]);
    if (startLon === undefined || startLat === undefined || endLon === undefined || endLat === undefined) {
      throw new Error(`Invalid coordinates in tabular line ${i + 1}`);
    }
    const rawMode = modeIdx >= 0 ? cols[modeIdx] : undefined;
    const rawEngine = engineIdx >= 0 ? cols[engineIdx] : undefined;
    const mode = normalizeMode(rawMode, defaults?.mode);
    const engine = normalizeEngine(rawEngine, defaults?.engine);
    const od: OdPair = {
      start: { lon: startLon, lat: startLat },
      end: { lon: endLon, lat: endLat },
    };
    if (mode) od.mode = mode;
    if (engine) od.engine = engine;
    out.push(od);
  }
  return out;
}

function splitTabularLine(line: string): string[] {
  return line.split(',').map((s) => s.trim());
}
