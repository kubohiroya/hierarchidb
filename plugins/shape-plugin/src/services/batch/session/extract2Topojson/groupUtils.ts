export const splitGroupByKey = <T>(
  items: T[],
  resolveKey: (item: T) => string,
): Array<{ key: string; items: T[] }> => {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const key = resolveKey(item);
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      groups.set(key, [item]);
    }
  }

  return Array.from(groups.entries()).map(([key, items]) => ({ key, items }));
};

export const sumBy = <T>(items: T[], select: (item: T) => number): number =>
  items.reduce((total, item) => total + select(item), 0);
