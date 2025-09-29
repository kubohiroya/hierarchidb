/**
 * Fetch metadata from OpenStreetMap (OSM)
 * OSM provides crowd-sourced geographic data
 */
export declare function fetchOSM(outputDirName: string, outputFileName: string): Promise<void>;
/**
 * Generates Overpass API query for a specific country and admin level
 * This can be used to fetch actual boundary data from OSM
 */
export declare function generateOverpassQuery(iso2: string, adminLevel: number): string;
//# sourceMappingURL=osm.d.ts.map