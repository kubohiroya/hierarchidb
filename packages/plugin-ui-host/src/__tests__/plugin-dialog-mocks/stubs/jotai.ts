export const atom = <T>(initial: T) => ({
  read: () => initial,
  write: (_: any, value: T) => value,
});
