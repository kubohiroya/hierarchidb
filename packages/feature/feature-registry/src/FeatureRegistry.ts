import type { FeatureContext, FeatureDefinition, FeatureManifest } from './types';

export class FeatureRegistry {
  private defs = new Map<string, FeatureDefinition>();
  private provided = new Map<string, any>();
  private started = new Set<string>();

  register(def: FeatureDefinition): void {
    const name = def.manifest.name;
    if (this.defs.has(name)) return; // idempotent
    this.defs.set(name, def);
  }

  get(name: string): FeatureDefinition | undefined {
    return this.defs.get(name);
  }

  list(): FeatureManifest[] {
    return [...this.defs.values()].map((d) => d.manifest);
  }

  async startAll(): Promise<void> {
    const order = this.topoSort();
    for (const name of order) await this.start(name);
  }

  async start(name: string): Promise<void> {
    if (this.started.has(name)) return;
    const def = this.defs.get(name);
    if (!def) throw new Error(`Feature not registered: ${name}`);
    // start dependencies first
    for (const dep of def.manifest.depends || []) await this.start(dep);
    const ctx: FeatureContext = {
      provide: (cap, value) => this.provided.set(cap, value ?? true),
      require: (cap) => this.provided.get(cap),
    };
    await def.init?.(ctx);
    await def.start?.();
    this.started.add(name);
  }

  async stopAll(): Promise<void> {
    const order = this.topoSort().reverse();
    for (const name of order) await this.stop(name);
  }

  async stop(name: string): Promise<void> {
    const def = this.defs.get(name);
    if (!def) return;
    if (!this.started.has(name)) return;
    await def.stop?.();
    this.started.delete(name);
  }

  private topoSort(): string[] {
    const visited = new Set<string>();
    const temp = new Set<string>();
    const order: string[] = [];
    const visit = (n: string) => {
      if (visited.has(n)) return;
      if (temp.has(n)) throw new Error(`Feature dependency cycle at ${n}`);
      temp.add(n);
      const d = this.defs.get(n);
      if (d) for (const dep of d.manifest.depends || []) visit(dep);
      temp.delete(n);
      visited.add(n);
      order.push(n);
    };
    for (const name of this.defs.keys()) visit(name);
    return order;
  }
}

