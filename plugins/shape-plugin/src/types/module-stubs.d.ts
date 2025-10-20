declare module '@hierarchidb/fetch-metadata/output/*.json' {
  const data: any[];
  export default data;
}

declare module '@hierarchidb/runtime-shared-batch-processor' {
  export type BatchProgressEvent = import('@hierarchidb/common-api').BatchProgressEvent;
  export type BatchSessionStatus = import('@hierarchidb/common-api').BatchSessionStatus;
}

declare module '@hierarchidb/plugin-runtime-services' {
  export * from '../../../../packages/plugin-runtime-services/src/index';
}

declare module '@hierarchidb/plugin-ui-sdk' {
  export * from '../../../../packages/plugin-ui-sdk/src/index';
}

declare module '@hierarchidb/compute' {
  export * from '../../../../packages/feature/compute/src/index';
}
