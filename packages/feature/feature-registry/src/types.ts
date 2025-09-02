export interface FeatureManifest {
  name: string;
  version?: string;
  provides?: string[]; // capabilities/features
  depends?: string[];  // other feature names
  optional?: string[]; // soft deps
}

export interface FeatureContext {
  provide: (cap: string, value?: any) => void;
  require: <T = any>(cap: string) => T | undefined;
}

export interface FeatureDefinition {
  manifest: FeatureManifest;
  init?: (ctx: FeatureContext) => Promise<void> | void;
  start?: () => Promise<void> | void;
  stop?: () => Promise<void> | void;
}

