import { RouteGenerator } from '../RouteGenerator.js';
import { SearouteEngine } from '../engines/SearouteEngine.js';
import { ROUTE_MODES, type RouteLineString } from '../../common/entities/RouteLineString.js';

const generator = new RouteGenerator({ searoute: new SearouteEngine() });

export async function applyIdeGsmWaypoints(
  lines: RouteLineString[],
): Promise<RouteLineString[]> {
  const out: RouteLineString[] = [];
  for (const line of lines) {
    out.push(await applyWaypoints(line));
  }
  return out;
}

async function applyWaypoints(line: RouteLineString): Promise<RouteLineString> {
  const method = resolveMethod(line);
  if (!method || !line.startPoint || !line.endPoint) {
    return { ...line, waypoints: undefined };
  }

  const points: [number, number][] = [
    line.startPoint.coordinates,
    line.endPoint.coordinates,
  ];
  const result = await generator.generate(points, { method });
  const next: RouteLineString = {
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

function resolveMethod(line: RouteLineString): 'great_circle' | 'searoute' | null {
  switch (line.routeMode) {
    case ROUTE_MODES.AIRWAY:
      return 'great_circle';
    case ROUTE_MODES.WATERWAY:
      return 'searoute';
    default:
      return null;
  }
}
