export function useWorkerAPIClient() {
  // Minimal stub; tests will vi.mock this module to inject behaviors
  return {
    getAPI() {
      return {
        async getPluginRegistryAPI() {
          return {
            async getExtension() {
              return {};
            }
          };
        }
      };
    }
  } as any;
}

