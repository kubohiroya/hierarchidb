export interface RawAddress {
  road?: string;
  house_number?: string;
  postcode?: string;
  city?: string;
  town?: string;
  village?: string;
  suburb?: string;
  state?: string;
  country?: string;
  country_code?: string;
}

export interface RawNominatimResult {
  osm_id: number | string;
  display_name?: string;
  class?: string;
  type?: string;
  osm_type?: string;
  lon?: string;
  lat?: string;
  boundingbox?: [string, string, string, string] | string[];
  address?: RawAddress;
  extratags?: Record<string, string>;
  importance?: number | string;
}

export interface RawOverpassElement {
  id: number | string;
  type?: string;
  lon?: number | string;
  lat?: number | string;
  center?: { lon?: number; lat?: number };
  tags?: Record<string, string>;
  importance?: number | string;
}
