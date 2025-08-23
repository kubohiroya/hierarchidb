import type { RegionMetadata } from "../utils/types";
import { saveMetadata } from "../utils/utils";

// Static list of major countries with OSM data
// In production, this could be fetched from Nominatim or Overpass API
const OSM_COUNTRIES = [
  {
    iso2: "AF",
    iso3: "AFG",
    name: "Afghanistan",
    osmId: "303427",
    adminLevels: [0, 1, 2, 3],
  },
  {
    iso2: "AL",
    iso3: "ALB",
    name: "Albania",
    osmId: "53292",
    adminLevels: [0, 1, 2],
  },
  {
    iso2: "DZ",
    iso3: "DZA",
    name: "Algeria",
    osmId: "192756",
    adminLevels: [0, 1, 2],
  },
  {
    iso2: "AR",
    iso3: "ARG",
    name: "Argentina",
    osmId: "286393",
    adminLevels: [0, 1, 2, 3],
  },
  {
    iso2: "AM",
    iso3: "ARM",
    name: "Armenia",
    osmId: "364066",
    adminLevels: [0, 1],
  },
  {
    iso2: "AU",
    iso3: "AUS",
    name: "Australia",
    osmId: "80500",
    adminLevels: [0, 1, 2],
  },
  {
    iso2: "AT",
    iso3: "AUT",
    name: "Austria",
    osmId: "16239",
    adminLevels: [0, 1, 2],
  },
  {
    iso2: "BD",
    iso3: "BGD",
    name: "Bangladesh",
    osmId: "184640",
    adminLevels: [0, 1, 2, 3, 4],
  },
  {
    iso2: "BE",
    iso3: "BEL",
    name: "Belgium",
    osmId: "52411",
    adminLevels: [0, 1, 2],
  },
  {
    iso2: "BR",
    iso3: "BRA",
    name: "Brazil",
    osmId: "59470",
    adminLevels: [0, 1, 2, 3],
  },
  {
    iso2: "BG",
    iso3: "BGR",
    name: "Bulgaria",
    osmId: "186382",
    adminLevels: [0, 1, 2],
  },
  {
    iso2: "CA",
    iso3: "CAN",
    name: "Canada",
    osmId: "1428125",
    adminLevels: [0, 1, 2, 3],
  },
  {
    iso2: "CL",
    iso3: "CHL",
    name: "Chile",
    osmId: "167454",
    adminLevels: [0, 1, 2, 3],
  },
  {
    iso2: "CN",
    iso3: "CHN",
    name: "China",
    osmId: "270056",
    adminLevels: [0, 1, 2, 3, 4],
  },
  {
    iso2: "CO",
    iso3: "COL",
    name: "Colombia",
    osmId: "120027",
    adminLevels: [0, 1, 2, 3],
  },
  {
    iso2: "CZ",
    iso3: "CZE",
    name: "Czech Republic",
    osmId: "51684",
    adminLevels: [0, 1, 2],
  },
  {
    iso2: "DK",
    iso3: "DNK",
    name: "Denmark",
    osmId: "50046",
    adminLevels: [0, 1, 2],
  },
  {
    iso2: "EG",
    iso3: "EGY",
    name: "Egypt",
    osmId: "1473947",
    adminLevels: [0, 1, 2],
  },
  {
    iso2: "FI",
    iso3: "FIN",
    name: "Finland",
    osmId: "54224",
    adminLevels: [0, 1, 2],
  },
  {
    iso2: "FR",
    iso3: "FRA",
    name: "France",
    osmId: "1403916",
    adminLevels: [0, 1, 2, 3, 4],
  },
  {
    iso2: "DE",
    iso3: "DEU",
    name: "Germany",
    osmId: "51477",
    adminLevels: [0, 1, 2, 3, 4],
  },
  {
    iso2: "GR",
    iso3: "GRC",
    name: "Greece",
    osmId: "192307",
    adminLevels: [0, 1, 2],
  },
  {
    iso2: "IN",
    iso3: "IND",
    name: "India",
    osmId: "304716",
    adminLevels: [0, 1, 2, 3, 4],
  },
  {
    iso2: "ID",
    iso3: "IDN",
    name: "Indonesia",
    osmId: "304751",
    adminLevels: [0, 1, 2, 3, 4],
  },
  {
    iso2: "IR",
    iso3: "IRN",
    name: "Iran",
    osmId: "304938",
    adminLevels: [0, 1, 2],
  },
  {
    iso2: "IQ",
    iso3: "IRQ",
    name: "Iraq",
    osmId: "304934",
    adminLevels: [0, 1, 2],
  },
  {
    iso2: "IE",
    iso3: "IRL",
    name: "Ireland",
    osmId: "62273",
    adminLevels: [0, 1, 2],
  },
  {
    iso2: "IL",
    iso3: "ISR",
    name: "Israel",
    osmId: "1473946",
    adminLevels: [0, 1, 2],
  },
  {
    iso2: "IT",
    iso3: "ITA",
    name: "Italy",
    osmId: "365331",
    adminLevels: [0, 1, 2, 3],
  },
  {
    iso2: "JP",
    iso3: "JPN",
    name: "Japan",
    osmId: "382313",
    adminLevels: [0, 1, 2, 3, 4],
  },
  {
    iso2: "KZ",
    iso3: "KAZ",
    name: "Kazakhstan",
    osmId: "214665",
    adminLevels: [0, 1, 2],
  },
  {
    iso2: "KE",
    iso3: "KEN",
    name: "Kenya",
    osmId: "192798",
    adminLevels: [0, 1, 2, 3],
  },
  {
    iso2: "KR",
    iso3: "KOR",
    name: "South Korea",
    osmId: "307756",
    adminLevels: [0, 1, 2, 3, 4],
  },
  {
    iso2: "MY",
    iso3: "MYS",
    name: "Malaysia",
    osmId: "2108121",
    adminLevels: [0, 1, 2, 3],
  },
  {
    iso2: "MX",
    iso3: "MEX",
    name: "Mexico",
    osmId: "114686",
    adminLevels: [0, 1, 2, 3],
  },
  {
    iso2: "NL",
    iso3: "NLD",
    name: "Netherlands",
    osmId: "47796",
    adminLevels: [0, 1, 2, 3],
  },
  {
    iso2: "NZ",
    iso3: "NZL",
    name: "New Zealand",
    osmId: "556706",
    adminLevels: [0, 1, 2],
  },
  {
    iso2: "NG",
    iso3: "NGA",
    name: "Nigeria",
    osmId: "192787",
    adminLevels: [0, 1, 2, 3],
  },
  {
    iso2: "NO",
    iso3: "NOR",
    name: "Norway",
    osmId: "2978650",
    adminLevels: [0, 1, 2],
  },
  {
    iso2: "PK",
    iso3: "PAK",
    name: "Pakistan",
    osmId: "307573",
    adminLevels: [0, 1, 2, 3],
  },
  {
    iso2: "PE",
    iso3: "PER",
    name: "Peru",
    osmId: "288247",
    adminLevels: [0, 1, 2, 3],
  },
  {
    iso2: "PH",
    iso3: "PHL",
    name: "Philippines",
    osmId: "443174",
    adminLevels: [0, 1, 2, 3, 4],
  },
  {
    iso2: "PL",
    iso3: "POL",
    name: "Poland",
    osmId: "49715",
    adminLevels: [0, 1, 2, 3],
  },
  {
    iso2: "PT",
    iso3: "PRT",
    name: "Portugal",
    osmId: "295480",
    adminLevels: [0, 1, 2],
  },
  {
    iso2: "RO",
    iso3: "ROU",
    name: "Romania",
    osmId: "90689",
    adminLevels: [0, 1, 2],
  },
  {
    iso2: "RU",
    iso3: "RUS",
    name: "Russia",
    osmId: "60189",
    adminLevels: [0, 1, 2, 3, 4],
  },
  {
    iso2: "SA",
    iso3: "SAU",
    name: "Saudi Arabia",
    osmId: "307584",
    adminLevels: [0, 1, 2],
  },
  {
    iso2: "SG",
    iso3: "SGP",
    name: "Singapore",
    osmId: "536780",
    adminLevels: [0, 1],
  },
  {
    iso2: "ZA",
    iso3: "ZAF",
    name: "South Africa",
    osmId: "87565",
    adminLevels: [0, 1, 2, 3],
  },
  {
    iso2: "ES",
    iso3: "ESP",
    name: "Spain",
    osmId: "1311341",
    adminLevels: [0, 1, 2, 3, 4],
  },
  {
    iso2: "SE",
    iso3: "SWE",
    name: "Sweden",
    osmId: "52822",
    adminLevels: [0, 1, 2],
  },
  {
    iso2: "CH",
    iso3: "CHE",
    name: "Switzerland",
    osmId: "51701",
    adminLevels: [0, 1, 2],
  },
  {
    iso2: "TH",
    iso3: "THA",
    name: "Thailand",
    osmId: "2067731",
    adminLevels: [0, 1, 2, 3, 4],
  },
  {
    iso2: "TR",
    iso3: "TUR",
    name: "Turkey",
    osmId: "174737",
    adminLevels: [0, 1, 2, 3],
  },
  {
    iso2: "UA",
    iso3: "UKR",
    name: "Ukraine",
    osmId: "60199",
    adminLevels: [0, 1, 2, 3],
  },
  {
    iso2: "AE",
    iso3: "ARE",
    name: "United Arab Emirates",
    osmId: "307763",
    adminLevels: [0, 1],
  },
  {
    iso2: "GB",
    iso3: "GBR",
    name: "United Kingdom",
    osmId: "62149",
    adminLevels: [0, 1, 2, 3, 4],
  },
  {
    iso2: "US",
    iso3: "USA",
    name: "United States",
    osmId: "148838",
    adminLevels: [0, 1, 2, 3, 4],
  },
  {
    iso2: "VN",
    iso3: "VNM",
    name: "Vietnam",
    osmId: "49915",
    adminLevels: [0, 1, 2, 3, 4],
  },
  // Southeast Asian countries
  {
    iso2: "KH",
    iso3: "KHM",
    name: "Cambodia",
    osmId: "49898",
    adminLevels: [0, 1, 2, 3, 4],
  },
  {
    iso2: "LA",
    iso3: "LAO",
    name: "Laos",
    osmId: "49903",
    adminLevels: [0, 1, 2, 3],
  },
  {
    iso2: "MM",
    iso3: "MMR",
    name: "Myanmar",
    osmId: "50371",
    adminLevels: [0, 1, 2, 3, 4],
  },
];

/**
 * Fetch metadata from OpenStreetMap (OSM)
 * OSM provides crowd-sourced geographic data
 */
export async function fetchOSM(
  outputDirName: string,
  outputFileName: string,
): Promise<void> {
  console.log("🗺️  Fetching OpenStreetMap metadata...");

  const metadata: RegionMetadata[] = [];

  try {
    // Since OSM doesn't provide a simple API for listing all countries,
    // we use a curated list of major countries
    console.log(
      `Processing ${OSM_COUNTRIES.length} countries from static data...`,
    );

    for (const country of OSM_COUNTRIES) {
      const regionData: RegionMetadata = {
        id: country.iso3,
        name: country.name,
        countryName: country.name,
        countryCode: country.iso2,
        iso2: country.iso2,
        iso3: country.iso3,
        continent: "", // OSM doesn't provide continent info directly
        region: "",
        subregion: "",
        adminLevels: country.adminLevels,
        numAdminLevels: country.adminLevels.length,
        bbox: getOSMBoundingBox(country.iso2),
      };

      metadata.push(regionData);
    }

    // Sort by name
    metadata.sort((a, b) => a.name.localeCompare(b.name));

    console.log(`Generated metadata for ${metadata.length} countries`);
    await saveMetadata(metadata, outputDirName, outputFileName);
  } catch (error) {
    console.error("Error processing OSM data:", error);
    throw error;
  }
}

/**
 * Get approximate bounding box for a country
 * In production, this would be fetched from Nominatim or calculated from actual boundaries
 */
function getOSMBoundingBox(iso2: string): [number, number, number, number] {
  const boxes: Record<string, [number, number, number, number]> = {
    JP: [122.9339, 24.046, 145.8173, 45.5227],
    KR: [125.0666, 33.1902, 131.8727, 38.6124],
    CN: [73.4997, 18.1633, 134.7728, 53.5609],
    IN: [68.1862, 6.7542, 97.4153, 35.5044],
    ID: [95.011, -10.9416, 141.0194, 5.9041],
    TH: [97.3438, 5.61, 105.6392, 20.4648],
    VN: [102.17, 8.18, 109.335, 23.393],
    MY: [99.6433, 0.8553, 119.2678, 7.3634],
    SG: [103.6057, 1.1587, 104.0885, 1.4708],
    PH: [116.9288, 4.6433, 126.6018, 21.1206],
    KH: [102.348, 10.4865, 107.6277, 14.6904],
    LA: [100.093, 13.91, 107.6977, 22.502],
    MM: [92.1719, 9.5988, 101.17, 28.5478],
    US: [-171.7911, 18.9117, -66.9649, 71.3577],
    CA: [-141.0027, 41.6751, -52.6194, 83.1106],
    GB: [-8.6218, 49.8825, 1.7681, 60.8458],
    FR: [-5.142, 41.3337, 9.5616, 51.0891],
    DE: [5.8663, 47.2701, 15.0419, 55.0582],
    IT: [6.6273, 35.4929, 18.5203, 47.0921],
    ES: [-18.1606, 27.6377, 4.3279, 43.7914],
    AU: [112.9211, -43.6345, 153.6395, -10.0621],
    BR: [-73.9872, -33.7507, -34.7933, 5.2648],
    RU: [19.2544, 41.1851, 191.1282, 81.8574],
  };

  return boxes[iso2] || [-180, -90, 180, 90];
}

/**
 * Generates Overpass API query for a specific country and admin level
 * This can be used to fetch actual boundary data from OSM
 */
export function generateOverpassQuery(
  iso2: string,
  adminLevel: number,
): string {
  return `
[out:json][timeout:300];
// Get country relation
relation["ISO3166-1:alpha2"="${iso2}"]["admin_level"="2"];
// Get admin boundaries at specified level
relation(area)["admin_level"="${adminLevel}"];
// Output geometry
out geom;
  `.trim();
}
