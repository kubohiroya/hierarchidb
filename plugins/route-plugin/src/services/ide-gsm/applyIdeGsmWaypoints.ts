import { RouteGenerator, SearouteEngine } from '@hierarchidb/route-engine';
import { ROUTE_MODES, type RouteFeature } from '@hierarchidb/route-store';

const generator = new RouteGenerator({ searoute: new SearouteEngine() });

export async function applyIdeGsmWaypoints(
  lines: RouteFeature[],
): Promise<RouteFeature[]> {
  const out: RouteFeature[] = [];
  for (const line of lines) {
    out.push(await applyWaypoints(line));
  }
  return out;
}

async function applyWaypoints(line: RouteFeature): Promise<RouteFeature> {
  const method = resolveMethod(line);
  if (!method || !line.startPoint || !line.endPoint) {
    return { ...line, waypoints: undefined };
  }

  const points: [number, number][] = [
    [line.startPoint.latitude, line.startPoint.longitude],
    [line.endPoint.latitude, line.endPoint.longitude],
  ];
  const result = await generator.generate(points, { method });
  const next: RouteFeature = {
    ...line,
    waypoints: result.lineGeometry,
    distance: result.distance ?? line.distance,
  };
  if (result.duration && result.distance) {
    next.speed = result.distance / result.duration;
  } else {
    next.speed = undefined;
  }
  return next;
}

function resolveMethod(line: RouteFeature): 'direct' | 'great_circle' | 'searoute' | null {
  switch (line.routeMode) {
    case ROUTE_MODES.AIRWAY:
      return 'great_circle';
    case ROUTE_MODES.WATERWAY:
      return 'searoute';
    case ROUTE_MODES.RAILWAY:
    case ROUTE_MODES.H_RAILWAY:
    case ROUTE_MODES.ROAD:
    case ROUTE_MODES.HIGHWAY:
      return 'direct';
    default:
      return null;
  }
}
