import type { CountryMetadata } from '~/common/types/index';

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / k ** i) * 100) / 100 + ' ' + sizes[i];
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

export function calculateEstimatedSize(totalSelections: number): number {
  // Rough estimate: 5MB per selection on average
  return totalSelections * 5 * 1024 * 1024;
}

export function calculateEstimatedFeatures(
  totalSelections: number,
  countries: CountryMetadata[]
): number {
  // Rough estimate based on population density
  const avgPopulation =
    countries.reduce((sum, c) => sum + (c.population || 0), 0) / countries.length;
  const featuresPerMillion = 100;
  return Math.floor(totalSelections * (avgPopulation / 1000000) * featuresPerMillion);
}
