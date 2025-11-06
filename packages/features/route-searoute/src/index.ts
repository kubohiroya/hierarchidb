// Placeholder implementation for @hierarchidb/route-searoute
// Spec-only package scaffold for typecheck/build consistency.

export type SeaRoutePort = {}

export class SeaRouteService {
  async plan(_from: string, _to: string): Promise<string[] | undefined> {
    return undefined;
  }
}

export class FeatureDefinition {
  static readonly manifest = { name: '@hierarchidb/route-searoute', provides: ['route-searoute'] };

  static init(): void {
    // no-op
  }
}

