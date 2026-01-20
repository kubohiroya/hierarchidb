export const GEOBOUNDARIES_RELEASE_TYPE = 'gbOpen';
export const GEOBOUNDARIES_API_BASE_URL = 'https://geoboundaries.org/api/current';
export const GEOBOUNDARIES_RELEASE_BASE_URL = `${GEOBOUNDARIES_API_BASE_URL}/${GEOBOUNDARIES_RELEASE_TYPE}`;
export const GEOBOUNDARIES_ALL_METADATA_URL = `${GEOBOUNDARIES_RELEASE_BASE_URL}/ALL/ALL/`;

export const buildGeoBoundariesMetadataUrl = (country: string, adminLevel: string): string => (
  `${GEOBOUNDARIES_RELEASE_BASE_URL}/${country}/${adminLevel}/`
);
