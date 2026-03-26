import { getYamlDB } from '@hierarchidb/yaml-store';

export interface RegisterYamlWorkerStoresOptions {
    signal?: AbortSignal;
}

export async function registerYamlWorkerStores(
    options: RegisterYamlWorkerStoresOptions = {}
): Promise<void> {
    if (options.signal?.aborted) {
        return;
    }
    // Initialize the YamlDB singleton so it is ready before any CRUD command arrives
    getYamlDB();
}
