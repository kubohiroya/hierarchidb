// Placeholder implementation for @hierarchidb/route-searoute
// Spec-only package scaffold for typecheck/build consistency.

export interface SeaRoutePort {
  // Placeholder for sea routing capabilities (e.g., coastal graph access)
}

export class SeaRouteService {
  async plan(_from: string, _to: string): Promise<string[] | undefined> {
    return undefined;
  }
}

export const featureDefinition = {
  manifest: { name: '@hierarchidb/route-searoute', provides: ['route-searoute'] },
  init() {},
};

