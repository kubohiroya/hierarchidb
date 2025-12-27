export type TileCoord = { x: number; y: number };

export type DistanceFn<T> = (longitude: number, latitude: number, value: T) => number;

export type NearestResult<T> = {
  item: T | null;
  distanceMeters: number | null;
};

export type MatchResult<T> = {
  item: T;
  distanceMeters: number;
};
type BTreeNode<T> = {
  key: number;
  values: T[];
  left: BTreeNode<T> | null;
  right: BTreeNode<T> | null;
};

export class BTree<T> {
  private root: BTreeNode<T> | null = null;

  insert(key: number, value: T): void {
    if (!this.root) {
      this.root = { key, values: [value], left: null, right: null };
      return;
    }
    let current = this.root;
    while (true) {
      if (key === current.key) {
        current.values.push(value);
        return;
      }
      if (key < current.key) {
        if (!current.left) {
          current.left = { key, values: [value], left: null, right: null };
          return;
        }
        current = current.left;
      } else {
        if (!current.right) {
          current.right = { key, values: [value], left: null, right: null };
          return;
        }
        current = current.right;
      }
    }
  }

  findNearestKey(target: number): BTreeNode<T> | null {
    let current = this.root;
    let best: BTreeNode<T> | null = null;
    let bestDelta = Infinity;
    while (current) {
      const delta = Math.abs(current.key - target);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = current;
      }
      if (target < current.key) {
        current = current.left;
      } else if (target > current.key) {
        current = current.right;
      } else {
        return current;
      }
    }
    return best;
  }

  forEachInRange(min: number, max: number, cb: (value: T) => void): void {
    const visit = (node: BTreeNode<T> | null) => {
      if (!node) return;
      if (min < node.key) visit(node.left);
      if (node.key >= min && node.key <= max) {
        for (const value of node.values) cb(value);
      }
      if (node.key < max) visit(node.right);
    };
    visit(this.root);
  }
}

export class LRUMap<K, V> {
  private readonly map = new Map<K, V>();

  constructor(private readonly maxSize: number) {}

  get(key: K): V | undefined {
    const value = this.map.get(key);
    if (value !== undefined) {
      this.map.delete(key);
      this.map.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    }
    this.map.set(key, value);
    if (this.map.size > this.maxSize) {
      const firstKey = this.map.keys().next().value as K | undefined;
      if (firstKey !== undefined) {
        this.map.delete(firstKey);
      }
    }
  }
}

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 0;
  return Math.max(0, Math.min(24, Math.round(zoom)));
}

export function toTileCoord(lon: number, lat: number, z: number): TileCoord {
  const scale = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * scale);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale,
  );
  return {
    x: Math.min(Math.max(x, 0), scale - 1),
    y: Math.min(Math.max(y, 0), scale - 1),
  };
}

const tile2lon = (x: number, z: number) => (x / 2 ** z) * 360 - 180;
const tile2lat = (y: number, z: number) => {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
};

export function tileToBbox(z: number, x: number, y: number) {
  const west = tile2lon(x, z);
  const east = tile2lon(x + 1, z);
  const north = tile2lat(y, z);
  const south = tile2lat(y + 1, z);
  return { west, south, east, north };
}

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function metersToLongitudeDelta(distance: number, latitude: number): number {
  if (!Number.isFinite(distance) || distance <= 0) return 0;
  const metersPerDegree = 111_320 * Math.cos((latitude * Math.PI) / 180);
  if (!Number.isFinite(metersPerDegree) || metersPerDegree <= 0) return 180;
  return distance / metersPerDegree;
}

export function findNearestInTree<T>(
  tree: BTree<T>,
  longitude: number,
  latitude: number,
  distanceFn: DistanceFn<T>,
): NearestResult<T> {
  const seed = tree.findNearestKey(longitude);
  if (!seed) return { item: null, distanceMeters: null };
  let best: T | null = null;
  let bestDistance = Infinity;
  for (const value of seed.values) {
    const distance = distanceFn(longitude, latitude, value);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = value;
    }
  }
  const lonRange = metersToLongitudeDelta(bestDistance, latitude);
  tree.forEachInRange(longitude - lonRange, longitude + lonRange, (value) => {
    const distance = distanceFn(longitude, latitude, value);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = value;
    }
  });
  return {
    item: best,
    distanceMeters: Number.isFinite(bestDistance) ? bestDistance : null,
  };
}

export function findWithinDistanceInTree<T>(
  tree: BTree<T>,
  longitude: number,
  latitude: number,
  maxDistanceMeters: number,
  distanceFn: DistanceFn<T>,
): MatchResult<T>[] {
  if (!Number.isFinite(maxDistanceMeters) || maxDistanceMeters <= 0) {
    return [];
  }
  const lonRange = metersToLongitudeDelta(maxDistanceMeters, latitude);
  const matches: MatchResult<T>[] = [];
  tree.forEachInRange(longitude - lonRange, longitude + lonRange, (value) => {
    const distance = distanceFn(longitude, latitude, value);
    if (distance <= maxDistanceMeters) {
      matches.push({ item: value, distanceMeters: distance });
    }
  });
  return matches;
}
