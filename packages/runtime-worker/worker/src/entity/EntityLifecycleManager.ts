import type { CommandEnvelope } from '../services/command-types';
import type { CoreDB } from '../services/CoreDB';

export class EntityLifecycleManager {
  private static instance: EntityLifecycleManager | undefined;
  private constructor(private coreDB: CoreDB) {}

  static getSingleton(coreDB: CoreDB): EntityLifecycleManager {
    if (!this.instance) this.instance = new EntityLifecycleManager(coreDB);
    return this.instance;
  }

  // Dispatch by command kind (base skeleton)
  async handleCommand(envelope: CommandEnvelope<string, unknown>): Promise<void> {
    switch (envelope.kind) {
      case 'commitWorkingCopy':
        return this.onCommitWorkingCopy(envelope as any);
      case 'duplicateNodes':
        return this.onDuplicateNodes(envelope as any);
      case 'pasteNodes':
        return this.onPasteNodes(envelope as any);
      case 'importNodes':
        return this.onImportNodes(envelope as any);
      default:
        // Other commands will be added incrementally
        return;
    }
  }

  // Below are no-op placeholders to be implemented in later phases.
  // They intentionally do not mutate state yet.
  async onCommitWorkingCopy(_env: CommandEnvelope<'commitWorkingCopy', any>): Promise<void> {}
  async onDuplicateNodes(_env: CommandEnvelope<'duplicateNodes', any>): Promise<void> {}
  async onPasteNodes(_env: CommandEnvelope<'pasteNodes', any>): Promise<void> {}
  async onImportNodes(_env: CommandEnvelope<'importNodes', any>): Promise<void> {}
}
