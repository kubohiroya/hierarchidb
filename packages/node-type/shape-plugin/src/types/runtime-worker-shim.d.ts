declare module '@hierarchidb/runtime-worker/entity/store-registry' {
  export const storeRegistry: {
    getPeer: (key: string) => any;
    registerPeer: (key: string, store: any) => void;
    getGroup: (key: string) => any;
    registerGroup: (key: string, store: any) => void;
    getRelations: (key: string) => any;
    registerRelations: (key: string, store: any) => void;
  };
}

