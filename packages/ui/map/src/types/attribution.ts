export type MapAttributionItem = {
  id: string;
  label: string;
  attribution?: string;
  url?: string;
  license?: string;
  licenseUrl?: string;
};

export type MapAttributionControlOptions = {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  compact?: boolean;
  items?: MapAttributionItem[];
};
