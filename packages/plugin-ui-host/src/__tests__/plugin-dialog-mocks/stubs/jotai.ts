export const atom = <T>(initial: T) => ({
  read: () => initial,
  write: (_: any, value: T) => value,
});

export const useAtom = <T>(value: T | (() => T)) => {
  const initial = typeof value === 'function' ? (value as () => T)() : value;
  const set = (next: T) => next;
  return [initial, set] as const;
};
