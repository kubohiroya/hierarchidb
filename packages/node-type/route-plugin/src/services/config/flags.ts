export function isFlagEnabled(name: string, fallback = false): boolean {
  const g: any = (globalThis as any);
  const env = (typeof process !== 'undefined' ? (process as any).env : undefined) || {};
  const ls = typeof localStorage !== 'undefined' ? localStorage : undefined;
  const v = ls?.getItem(name) ?? g?.[name] ?? env?.[name];
  if (v == null) return fallback;
  const s = String(v).toLowerCase();
  return s === '1' || s === 'true' || s === 'on' || s === 'enabled';
}

