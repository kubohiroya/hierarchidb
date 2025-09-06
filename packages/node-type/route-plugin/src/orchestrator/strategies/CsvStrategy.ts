import type { DataSourceSpec, DataSourceStrategy, ParseTask, StrategyContext, TaskPlan, OdPair } from '../types';

export class CsvStrategy implements DataSourceStrategy {
  supports(spec: DataSourceSpec): boolean { return spec.type === 'csv'; }
  async plan(spec: DataSourceSpec, ctx: StrategyContext): Promise<TaskPlan> {
    const id = `${ctx.planId}:csv:0`;
    if (spec.inline && !spec.url) return { fetch: [], parse: [{ kind: 'parse', source: 'csv', payloadRef: id }] };
    if (!spec.url) throw new Error('CSV strategy requires url or inline');
    return { fetch: [{ kind: 'fetch', url: spec.url }], parse: [{ kind: 'parse', source: 'csv', payloadRef: spec.url }] };
  }
  async executeParse(task: ParseTask, blobs: Map<string, Blob>, defaults?: { engine?: string; mode?: string }): Promise<OdPair[]> {
    const blob = blobs.get(task.payloadRef); if (!blob) throw new Error(`Missing payload for ${task.payloadRef}`);
    const text = await blob.text();
    return parseCsvToOds(text, defaults);
  }
}

function parseCsvToOds(csv: string, defaults?: { engine?: string; mode?: string }): OdPair[] {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const header = lines[0]!.split(',').map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const lon1 = idx('lon1'); const lat1 = idx('lat1');
  const lon2 = idx('lon2'); const lat2 = idx('lat2');
  const modeIdx = idx('mode'); const engineIdx = idx('engine');
  if (lon1 < 0 || lat1 < 0 || lon2 < 0 || lat2 < 0) throw new Error('CSV must include lon1,lat1,lon2,lat2 columns');
  const out: OdPair[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]!);
    const o: OdPair = {
      start: { lon: parseFloat(cols[lon1]!), lat: parseFloat(cols[lat1]!) },
      end:   { lon: parseFloat(cols[lon2]!), lat: parseFloat(cols[lat2]!) },
      mode: (cols[modeIdx!] || defaults?.mode) as any,
      engine: (cols[engineIdx!] || defaults?.engine) as any,
    };
    out.push(o);
  }
  return out;
}

function splitCsvLine(line: string): string[] { return line.split(',').map((s) => s.trim()); }

