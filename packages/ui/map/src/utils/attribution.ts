import type { MapAttributionItem } from '~/types/attribution';

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case '\'':
        return '&#39;';
      default:
        return char;
    }
  });

const buildLink = (label: string, url?: string): string => {
  const safeLabel = escapeHtml(label);
  if (!url) return safeLabel;
  const safeUrl = escapeHtml(url);
  return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeLabel}</a>`;
};

const formatAttributionItem = (item: MapAttributionItem): string => {
  const baseLabel = item.attribution ?? item.label;
  const baseText = buildLink(baseLabel, item.url);
  if (!item.license) return baseText;
  const licenseText = buildLink(item.license, item.licenseUrl);
  return `${baseText} (License: ${licenseText})`;
};

export const formatAttributionItems = (items: MapAttributionItem[]): string[] => {
  const unique = new Map<string, string>();
  items.forEach((item) => {
    const key = item.id || item.label;
    if (unique.has(key)) return;
    unique.set(key, formatAttributionItem(item));
  });
  return Array.from(unique.values());
};
