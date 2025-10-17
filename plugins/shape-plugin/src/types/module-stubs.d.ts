declare module '@hierarchidb/fetch-metadata/output/*.json' {
  const data: any[];
  export default data;
}

declare module '@hierarchidb/runtime-shared-batch-processor' {
  export type BatchProgressEvent = import('@hierarchidb/common-api').BatchProgressEvent;
  export type BatchSessionStatus = import('@hierarchidb/common-api').BatchSessionStatus;
}
