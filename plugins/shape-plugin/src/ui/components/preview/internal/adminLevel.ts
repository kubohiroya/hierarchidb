export const parseAdminLevelValue = (value: unknown): number | undefined => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.trunc(value) : undefined;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;

    const direct = Number(trimmed);
    if (Number.isFinite(direct)) return Math.trunc(direct);

    const labeled = /^adm(?:in)?\s*(\d+)$/i.exec(trimmed);
    if (labeled) {
      return Number(labeled[1]);
    }
  }

  return undefined;
};
