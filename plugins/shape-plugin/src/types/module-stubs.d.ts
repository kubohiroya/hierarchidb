declare module '@hierarchidb/fetch-save-metadata/output/*.json' {
  const data: any[];
  export default data;
}

declare module '@hierarchidb/runtime-shared-batch-processor' {
  export type BatchProgressEvent = import('@hierarchidb/common-api').BatchProgressEvent;
  export type BatchSessionStatus = import('@hierarchidb/common-api').BatchSessionStatus;
}

declare module '@hierarchidb/compute' {
  export * from '../../../../packages/features/compute/src/index';
}
