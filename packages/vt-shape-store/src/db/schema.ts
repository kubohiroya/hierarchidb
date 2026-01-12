export const vtShapeStoreSchema = {
  fetchCache:
    '&id, nodeId, domainType, sourceKey, [nodeId+domainType], [nodeId+domainType+sourceKey]'
    + ', countryCode, adminLevel, timestamp',
  transformByBandCache:
    '&id, nodeId, bandId, domainType, sourceKey, [nodeId+bandId], [nodeId+bandId+sourceKey]'
    + ', countryCode, adminLevel, timestamp',
  transformByZoomCache: '&[nodeId+bandId+tileId+bufferId], [nodeId+bandId+tileId], [nodeId+bandId+bufferId]'
    + ', bandId, zBase, tileId, bufferId',
  transformByZoomReservations: '&[nodeId+tileId], nodeId, tileId, createdAt',
};
