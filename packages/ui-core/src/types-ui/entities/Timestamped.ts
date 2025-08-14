/**
 * @file Timestamped.ts
 * @description Interface for entities with timestamps
 */

/**
 * Interface for entities that track creation and update times
 */
export interface Timestamped {
  /**
   * Unix timestamp when the entity was created
   */
  createdAt: number;

  /**
   * Unix timestamp when the entity was last updated
   */
  updatedAt: number;
}
