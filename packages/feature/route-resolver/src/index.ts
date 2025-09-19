// Placeholder implementation for @hierarchidb/route-resolver
// Spec-only package for now; this file exists to satisfy build tooling.

export interface GraphPort {
  // Placeholder for graph access methods (CSR/COO providers etc.)
}

export interface StorePort {
  // Placeholder for block matrix persistence methods
}

export class ResolverService {
  // Placeholder APSP runner
  async runAPSP(_graph: GraphPort, _store?: StorePort): Promise<void> {
    // no-op (spec-only)
  }

  // Placeholder distance query
  async queryDistance(_a: string, _b: string): Promise<number | undefined> {
    return undefined;
  }

  // Placeholder path query
  async queryPath(_a: string, _b: string): Promise<string[] | undefined> {
    return undefined;
  }
}

export class FeatureDefinition {
  static readonly manifest = { name: '@hierarchidb/route-resolver', provides: ['route-resolver'] };

  static init(): void {
    // no-op
  }
}

