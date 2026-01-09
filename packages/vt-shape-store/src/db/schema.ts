export const vtShapeStoreSchema = {
  stage1Buffers:
    '&id, nodeId, domainType, sourceKey, [nodeId+domainType], [nodeId+domainType+sourceKey]'
    + ', countryCode, adminLevel, timestamp',
  transformBandBuffers:
    '&id, nodeId, bandId, domainType, sourceKey, [nodeId+bandId], [nodeId+bandId+sourceKey]'
    + ', countryCode, adminLevel, timestamp',
  tileIndexBand: '&[nodeId+bandId+tileId+bufferId], [nodeId+bandId+tileId], [nodeId+bandId+bufferId]'
    + ', bandId, zBase, tileId, bufferId',
  vtBand3Reservations: '&[nodeId+tileId], nodeId, tileId, createdAt',
};
