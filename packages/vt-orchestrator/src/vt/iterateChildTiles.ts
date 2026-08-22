import { packTileId, parentToChildRange } from '~/tiles/tileId';

export type ChildTile = {
  z: number;
  x: number;
  y: number;
  tileId: number;
};

export const iterateChildTiles = function* ({
  parent,
  band,
  assertNotAborted,
  abortSignal,
}: {
  parent: { z: number; x: number; y: number };
  band: { zMin: number; zMax: number };
  assertNotAborted: (signal?: AbortSignal) => void;
  abortSignal?: AbortSignal;
}): IterableIterator<ChildTile> {
  for (let z = band.zMin; z <= band.zMax; z++) {
    assertNotAborted(abortSignal);
    const { xStart, xEnd, yStart, yEnd } = parentToChildRange(parent, z);
    for (let x = xStart; x <= xEnd; x++) {
      assertNotAborted(abortSignal);
      for (let y = yStart; y <= yEnd; y++) {
        assertNotAborted(abortSignal);
        yield {
          z,
          x,
          y,
          tileId: packTileId(x, y, z),
        };
      }
    }
  }
};
