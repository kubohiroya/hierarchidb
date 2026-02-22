export type StageArtifactName = string;

export interface BufferDescriptor {
  id: string;
}

/**
 * stage artifact の永続化ストア（Dexie/API 等）の抽象。
 */
export interface ArtifactStorePort {
  putBuffer(stage: StageArtifactName, bufferId: string, buffer: ArrayBuffer): Promise<void>;
  getBuffer(stage: StageArtifactName, bufferId: string): Promise<ArrayBuffer | undefined>;
  listBuffers(stage: StageArtifactName): Promise<BufferDescriptor[]>;
}

