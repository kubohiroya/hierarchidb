/**
 * Draft properties for nodes that are being created but not yet complete
 */
export interface DraftProperties {
  /**
   * Indicates if this is a draft node where entities/sub-entities are incomplete
   * Managed by node-type-specific extension modules
   */
  isDraft?: boolean;
}
