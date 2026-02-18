export const shallowEqualRecord = <T extends Record<string, unknown> | null | undefined>(a: T, b: T): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => (a as Record<string, unknown>)[key] === (b as Record<string, unknown>)[key]);
};
