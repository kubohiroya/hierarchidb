export * from './ports.js';
export * from './AuthRecoveryService.js';
export * from './capability.js';

export const featureDefinition = {
  manifest: { name: '@hierarchidb/auth-recovery', provides: ['auth-recovery'] },
  init() {
  },
};

