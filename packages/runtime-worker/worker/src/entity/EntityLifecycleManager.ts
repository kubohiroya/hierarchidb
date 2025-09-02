import type { CommandEnvelope } from '../services/command-types';
import type { CoreDB } from '../services/CoreDB';

export class EntityLifecycleManager {
  private static instance: EntityLifecycleManager | undefined;
  private constructor(private coreDB: CoreDB) {}

  static getSingleton(coreDB: CoreDB): EntityLifecycleManager {
    if (!this.instance) this.instance = new EntityLifecycleManager(coreDB);
    return this.instance;
  }

  // Base skeleton: accept envelope and decide later
  async handleCommand(envelope: CommandEnvelope<string, unknown>): Promise<void> {
    // Skeleton: no-op for now; concrete handlers will be wired in future steps.
    void envelope; // keep type usage
  }
}

