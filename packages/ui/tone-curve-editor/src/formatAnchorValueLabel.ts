export const formatAnchorValueLabel = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '';
  }

  if (Math.abs(value - Math.round(value)) < 1e-9) {
    return String(Math.round(value));
  }

  return String(Number.parseFloat(value.toFixed(3)));
};
