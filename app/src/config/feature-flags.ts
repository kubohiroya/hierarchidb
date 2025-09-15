// UI-side feature flags with sensible defaults toward the latest implementation.
// Reads from globalThis.FEATURE_FLAGS (preferred) and falls back to import.meta.env if needed.

function readFlag(key: string): string | undefined {
  const g: any = (globalThis as any);
  const v1 = g?.FEATURE_FLAGS?.[key];
  if (v1 != null) return String(v1);
  const v2 = (import.meta as any)?.env?.[key] ?? (import.meta as any)?.env?.[`VITE_${key}`];
  if (v2 != null) return String(v2);
  return undefined;
}

function flagOn(key: string, def = false): boolean {
  const raw = readFlag(key);
  if (raw == null) return !!def;
  const s = String(raw).toLowerCase();
  return s === '1' || s === 'true' || s === 'on' || s === 'enabled';
}

export const UI_FLAGS = {
  // Default OFF (latest implementation does not allow legacy API by default)
  get UI_DIALOG_ALLOW_LEGACY_DISPLAYMODE() { return flagOn('UI_DIALOG_ALLOW_LEGACY_DISPLAYMODE', false); },
} as const;
