export function useWorkerAPIClient() {
  // Minimal stub; tests will vi.mock this module to inject behaviors
  const api = {
    async getPluginRegistryAPI() {
      return {
        async getExtension() {
          return {};
        },
      };
    },
  };
  return {
    client: api,
    isInitialized: true,
    isConnected: true,
    initProgress: 100,
    initMessage: 'ready',
    error: null,
    initialize: async () => {},
    reset: () => {},
    getAPI() {
      return api;
    },
  } as any;
}

