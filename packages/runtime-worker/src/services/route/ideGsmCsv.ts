import type { NodeId } from '@hierarchidb/common-types';
import type { LocationQueryAPI } from '@hierarchidb/location-api';
import type {
  IdeGsmLocationRecord,
  IdeGsmRouteError,
  RouteLineString,
} from '@hierarchidb/route-api';
import { parseIdeGsmRouteCsv } from '@hierarchidb/route-api';

type LocationLookup = Map<string, IdeGsmLocationRecord>;

export async function buildIdeGsmLocationIndex(
  api: LocationQueryAPI,
  nodeIds: NodeId[]
): Promise<LocationLookup> {
  const index = new Map<string, IdeGsmLocationRecord>();
  for (const nodeId of nodeIds) {
    const items = await api.listLocationGroups(nodeId);
    for (const item of items) {
      const data = item.data;
      if (!data?.name) continue;
      if (index.has(data.name)) continue;
      index.set(data.name, {
        id: item.id as NodeId,
        name: data.name,
        latitude: data.latitude,
        longitude: data.longitude,
        pointId: data.pointId,
        admin0Name: data.admin0Name,
        admin1Name: data.admin1Name,
        admin2Name: data.admin2Name,
        admin0Code: data.admin0Code,
        admin1Code: data.admin1Code,
        admin2Code: data.admin2Code,
      });
    }
  }
  return index;
}

export function parseIdeGsmCsv(
  csvText: string,
  locationIndex: LocationLookup,
  nodeId: NodeId
): { lineStrings: RouteLineString[]; errors: IdeGsmRouteError[] } {
  return parseIdeGsmRouteCsv(csvText, locationIndex, nodeId);
}
