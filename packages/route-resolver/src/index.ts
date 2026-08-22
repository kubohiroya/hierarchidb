// Placeholder implementation for @hierarchidb/route-resolver
// Spec-only package for now; this file exists to satisfy stage tooling.

export type GraphPort = {};

export type StorePort = {};

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
