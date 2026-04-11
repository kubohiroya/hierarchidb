import type { NodeId } from '@hierarchidb/core-types';
import type { LocationFeatureId, LocationQueryAPI } from '@hierarchidb/location-api';
import type {
  IdeGsmCsvError,
  IdeGsmLocationRecord,
  RouteFeature,
} from '@hierarchidb/route-api';
import { parseIdeGsmRouteCsv as parseIdeGsmRouteCsvCore } from '@hierarchidb/route-api';

type LocationLookup = Map<string, IdeGsmLocationRecord>;

export async function buildIdeGsmLocationIndex(
  api: LocationQueryAPI,
  nodeIds: NodeId[],
): Promise<LocationLookup> {
  const index = new Map<string, IdeGsmLocationRecord>();
  for (const nodeId of nodeIds) {
    const items = await api.listLocationGroups(nodeId);
    for (const item of items) {
      const data = item.data;
      if (!data?.name) continue;
      if (index.has(data.name)) continue;
      index.set(data.name, {
        locationFeatureId: item.id as LocationFeatureId,
        locationNodeId: nodeId,
        name: data.name,
        latitude: data.latitude,
        longitude: data.longitude,
        pointId: data.pointId,
        admin0Name: data.admin0,
        admin1Name: data.admin1,
        admin2Name: data.admin2,
        admin0Code: data.admin0Code,
        admin1Code: data.admin1Code,
        admin2Code: data.admin2Code,
      });
    }
  }
  return index;
}

export function parseIdeGsmRouteCsv(
  csvText: string,
  locationIndex: LocationLookup,
  nodeId: NodeId,
): { lineStrings: RouteFeature[]; errors: IdeGsmCsvError[] } {
  return parseIdeGsmRouteCsvCore(csvText, locationIndex, nodeId);
}
