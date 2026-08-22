declare const __HDB_YAML_STORAGE_CORRECTIVE_RECOVERY_MODE__: unknown;
declare const __HDB_YAML_STORAGE_CORRECTIVE_RECOVERY_FINGERPRINT__: unknown;

const RECOVERY_RELEASE_ID = 'incident-1388-v1' as const;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;

export type YamlStorageCorrectiveRecoveryConfig =
  | Readonly<{ readonly status: 'disabled' }>
  | Readonly<{
      readonly status: 'enabled';
      readonly recoveryReleaseId: typeof RECOVERY_RELEASE_ID;
      readonly expectedCoordinatorFingerprintSha256: string;
    }>;

/** Reads the startup-fixed one-off recovery configuration injected by Vite. */
export function getYamlStorageCorrectiveRecoveryConfig(): YamlStorageCorrectiveRecoveryConfig {
  if (__HDB_YAML_STORAGE_CORRECTIVE_RECOVERY_MODE__ === 'disabled') {
    if (__HDB_YAML_STORAGE_CORRECTIVE_RECOVERY_FINGERPRINT__ !== null) {
      throw new Error('yaml-storage-corrective-recovery-disabled-fingerprint-present');
    }
    return Object.freeze({ status: 'disabled' });
  }
  if (
    __HDB_YAML_STORAGE_CORRECTIVE_RECOVERY_MODE__ !== RECOVERY_RELEASE_ID ||
    typeof __HDB_YAML_STORAGE_CORRECTIVE_RECOVERY_FINGERPRINT__ !== 'string' ||
    !SHA256_PATTERN.test(__HDB_YAML_STORAGE_CORRECTIVE_RECOVERY_FINGERPRINT__)
  ) {
    throw new Error('yaml-storage-corrective-recovery-configuration-invalid');
  }
  return Object.freeze({
    status: 'enabled',
    recoveryReleaseId: RECOVERY_RELEASE_ID,
    expectedCoordinatorFingerprintSha256: __HDB_YAML_STORAGE_CORRECTIVE_RECOVERY_FINGERPRINT__,
  });
}
