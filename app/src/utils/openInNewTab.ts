export const openInNewTab = (url: string): void => {
  if (typeof window === 'undefined') return;
  const resolved = new URL(url, window.location.href).toString();
  window.open(resolved, '_blank', 'noopener,noreferrer');
};
