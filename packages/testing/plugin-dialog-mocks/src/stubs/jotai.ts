export const atom = <T>(initial: T) => ({
  read: () => initial,
  write: (_: unknown, value: T) => value,
});
