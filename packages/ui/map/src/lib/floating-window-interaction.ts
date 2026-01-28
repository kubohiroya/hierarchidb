export const isFloatingWindowInteractionActive = (): boolean => {
  if (typeof document === 'undefined') return false;
  const body = document.body;
  if (!body) return false;
  return body.dataset.hdbFloatingWindowInteraction === '1';
};

