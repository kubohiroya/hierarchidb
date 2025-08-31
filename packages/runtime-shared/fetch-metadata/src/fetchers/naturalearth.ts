import type { RegionMetadata } from "../utils/types";
import { saveMetadata } from "../utils/utils";

interface NaturalEarthProperties {
  NAME?: string;
  NAME_EN?: string;
  ISO_A2?: string;
  ISO_A3?: string;
  CONTINENT?: string;
  REGION_UN?: string;
  SUBREGION?: string;
  ADMIN?: string;
}

interface NaturalEarthFeature {
  type: string;
  properties: NaturalEarthProperties;
  geometry?: {
    type: string;
    coordinates: any;
  };
}

/**
 * Fetch metadata from Natural Earth
 * Natural Earth provides free vector and raster map data at various scales
 */
export async function fetchNaturalEarth(
  outputDirName: string,
  outputFileName: string,
): Promise<void> {
  console.log("🌍 Fetching Natural Earth metadata...");

  const metadata: RegionMetadata[] = [];

  try {
    // Natural Earth provides data at different scales (10m, 50m, 110m)
    // Using GitHub repository for consistent access
    const urls = {
      countries_10m:
        "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson",
      countries_50m:
        "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson",
    };

    console.log("Fetching Natural Earth countries data (10m resolution)...");
    const response = await fetch(urls.countries_10m);

    if (!response.ok) {
      // Fallback to 50m resolution if 10m fails
      console.log("10m resolution failed, trying 50m resolution...");
      const response50m = await fetch(urls.countries_50m);
      if (!response50m.ok) {
        throw new Error(
          `HTTP ${response50m.status}: ${response50m.statusText}`,
        );
      }
      const data = await response50m.json();
      processNaturalEarthData(data, metadata);
    } else {
      const data = await response.json();
      processNaturalEarthData(data, metadata);
    }

    console.log(`Found ${metadata.length} valid countries`);

    // Sort by name
    metadata.sort((a, b) => a.name.localeCompare(b.name));

    await saveMetadata(metadata, outputDirName, outputFileName);
  } catch (error) {
    console.error("Error fetching Natural Earth data:", error);
    throw error;
  }
}

function processNaturalEarthData(data: any, metadata: RegionMetadata[]): void {
  if (data.features && Array.isArray(data.features)) {
    for (const feature of data.features as NaturalEarthFeature[]) {
      const country = parseNaturalEarthFeature(feature);
      if (country && validateNaturalEarthCountry(country)) {
        metadata.push(country);
      }
    }
  }
}

/**
 * Parse Natural Earth feature to RegionMetadata
 */
function parseNaturalEarthFeature(
  feature: NaturalEarthFeature,
): RegionMetadata | null {
  const props = feature.properties;

  if (!props) {
    return null;
  }

  const name = props.NAME || props.NAME_EN || props.ADMIN || "";
  const iso2 = props.ISO_A2 || "";
  const iso3 = props.ISO_A3 || "";

  // Skip invalid entries
  if (!name || iso2 === "-99" || iso3 === "-99") {
    return null;
  }

  // Calculate bounding box from geometry if available
  let bbox: [number, number, number, number] = [-180, -90, 180, 90];
  if (feature.geometry) {
    bbox = calculateBoundingBox(feature.geometry);
  }

  return {
    id: iso3 || iso2 || name,
    name: name,
    countryName: name,
    countryCode: iso2,
    iso2: iso2,
    iso3: iso3,
    continent: props.CONTINENT || "",
    region: props.REGION_UN || "",
    subregion: props.SUBREGION || "",
    adminLevels: [0, 1], // Natural Earth primarily provides country-level data
    numAdminLevels: 2,
    bbox: bbox,
  };
}

/**
 * Calculate bounding box from geometry
 */
function calculateBoundingBox(geometry: any): [number, number, number, number] {
  let minLon = 180,
    maxLon = -180;
  let minLat = 90,
    maxLat = -90;

  const processCoordinates = (coords: any): void => {
    if (Array.isArray(coords)) {
      if (typeof coords[0] === "number" && typeof coords[1] === "number") {
        // This is a coordinate pair [lon, lat]
        minLon = Math.min(minLon, coords[0]);
        maxLon = Math.max(maxLon, coords[0]);
        minLat = Math.min(minLat, coords[1]);
        maxLat = Math.max(maxLat, coords[1]);
      } else {
        // Recurse for nested arrays
        coords.forEach(processCoordinates);
      }
    }
  };

  if (geometry.coordinates) {
    processCoordinates(geometry.coordinates);
  }

  // Return default bbox if calculation failed
  if (minLon === 180 || maxLon === -180 || minLat === 90 || maxLat === -90) {
    return [-180, -90, 180, 90];
  }

  return [minLon, minLat, maxLon, maxLat];
}

/**
 * Validate Natural Earth country data
 */
function validateNaturalEarthCountry(country: RegionMetadata): boolean {
  return (
    country.name.length > 0 &&
    (country.iso2.length === 2 || country.iso3.length === 3) &&
    country.iso2 !== "-99" &&
    country.iso3 !== "-99"
  );
}
