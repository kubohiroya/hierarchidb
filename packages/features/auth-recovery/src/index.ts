export * from './ports.js';
export * from './AuthService.js';
export * from './AuthRecoveryService.js';
export * from './capability.js';

export class FeatureDefinition {
  static readonly manifest = { name: '@hierarchidb/auth-recovery', provides: ['auth-recovery'] };

  static init(): void {
    // no-op
  }
}
