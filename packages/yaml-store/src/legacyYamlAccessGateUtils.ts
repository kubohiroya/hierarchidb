let legacyYamlAccessRevoked = false;
let closeLegacyYamlDatabase: (() => void) | null = null;

export function assertLegacyYamlAccessAllowed(): void {
  if (legacyYamlAccessRevoked) throw new Error('legacy-yaml-access-revoked');
}

export function registerLegacyYamlDatabaseClose(close: () => void): void {
  assertLegacyYamlAccessAllowed();
  closeLegacyYamlDatabase = close;
}

export function revokeLegacyYamlAccessAndClose(): void {
  legacyYamlAccessRevoked = true;
  const close = closeLegacyYamlDatabase;
  closeLegacyYamlDatabase = null;
  close?.();
}
