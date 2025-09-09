export * from './ports';
export * from './AuthRecoveryService';
export * from './capability';

export const featureDefinition = {
  manifest: { name: '@hierarchidb/auth-recovery', provides: ['auth-recovery'] },
  init() {
  },
};

