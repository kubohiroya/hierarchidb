export const vtShapeStoreSchema = {
  fetchCache:
    '&id, nodeId, domainType, sourceKey, [nodeId+domainType], [nodeId+domainType+sourceKey]'
    + ', countryCode, adminLevel, timestamp',
  transformCache:
    '&id, nodeId, bandId, domainType, sourceKey, [nodeId+bandId], [nodeId+bandId+sourceKey]'
    + ', countryCode, adminLevel, timestamp',
};
