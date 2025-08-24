import type { NodeId } from '../types/ids';

export function assertNonNull<T>(
  value: T | null | undefined,
  message: string = 'Value is required'
): asserts value is T {
  if (value == null) {
    throw new Error(message);
  }
}

export function isValidTreeNodeName(name: string): boolean {
  if (!name || name.trim().length === 0) {
    return false;
  }

  // Check for invalid characters
  const invalidChars = /[\/:*?"<>|]/;
  if (invalidChars.test(name)) {
    return false;
  }

  // Check max length
  if (name.length > 255) {
    return false;
  }

  return true;
}

/**
 * Common node validation constants
 */
export const NODE_VALIDATION_CONSTANTS = {
  NAME_MIN_LENGTH: 1,
  NAME_MAX_LENGTH: 255,
  DESCRIPTION_MAX_LENGTH: 1000,
  MAX_TAGS: 10,
  MAX_TAG_LENGTH: 50,
  INVALID_NAME_CHARS: /[<>:"/\|?*]/,
} as const;

/**
 * Common validation result type
 */
export interface CommonValidationResult {
  isValid: boolean;
  error?: string;
  errors?: string[];
}

/**
 * Enhanced node name validation with detailed error messages
 */
export function validateNodeName(name: string): CommonValidationResult {
  if (!name || typeof name !== 'string') {
    return { isValid: false, error: 'Name is required' };
  }

  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { isValid: false, error: 'Name cannot be empty' };
  }

  if (trimmed.length < NODE_VALIDATION_CONSTANTS.NAME_MIN_LENGTH) {
    return { isValid: false, error: `Name must be at least ${NODE_VALIDATION_CONSTANTS.NAME_MIN_LENGTH} character` };
  }

  if (trimmed.length > NODE_VALIDATION_CONSTANTS.NAME_MAX_LENGTH) {
    return { isValid: false, error: `Name must be less than ${NODE_VALIDATION_CONSTANTS.NAME_MAX_LENGTH} characters` };
  }

  if (NODE_VALIDATION_CONSTANTS.INVALID_NAME_CHARS.test(trimmed)) {
    return { isValid: false, error: 'Name contains invalid characters (< > : " / \ | ? *)' };
  }

  return { isValid: true };
}

/**
 * Common description validation
 */
export function validateNodeDescription(description?: string): CommonValidationResult {
  if (!description) {
    return { isValid: true }; // Optional field
  }

  if (typeof description !== 'string') {
    return { isValid: false, error: 'Description must be a string' };
  }

  if (description.length > NODE_VALIDATION_CONSTANTS.DESCRIPTION_MAX_LENGTH) {
    return { isValid: false, error: `Description must be less than ${NODE_VALIDATION_CONSTANTS.DESCRIPTION_MAX_LENGTH} characters` };
  }

  return { isValid: true };
}

/**
 * Common tags validation
 */
export function validateNodeTags(tags?: string[]): CommonValidationResult {
  if (!tags) {
    return { isValid: true }; // Optional field
  }

  if (!Array.isArray(tags)) {
    return { isValid: false, error: 'Tags must be an array' };
  }

  if (tags.length > NODE_VALIDATION_CONSTANTS.MAX_TAGS) {
    return { isValid: false, error: `Maximum ${NODE_VALIDATION_CONSTANTS.MAX_TAGS} tags allowed` };
  }

  for (const tag of tags) {
    if (typeof tag !== 'string') {
      return { isValid: false, error: 'All tags must be strings' };
    }
    
    if (tag.length > NODE_VALIDATION_CONSTANTS.MAX_TAG_LENGTH) {
      return { isValid: false, error: `Tag "${tag}" is too long (max ${NODE_VALIDATION_CONSTANTS.MAX_TAG_LENGTH} characters)` };
    }
  }

  return { isValid: true };
}

/**
 * Generic node data validation
 */
export interface NodeDataValidation {
  name: string;
  description?: string;
  tags?: string[];
  [key: string]: any;
}

export function validateCommonNodeData(data: NodeDataValidation): CommonValidationResult {
  const errors: string[] = [];

  // Name validation
  const nameValidation = validateNodeName(data.name);
  if (!nameValidation.isValid && nameValidation.error) {
    errors.push(nameValidation.error);
  }

  // Description validation
  const descValidation = validateNodeDescription(data.description);
  if (!descValidation.isValid && descValidation.error) {
    errors.push(descValidation.error);
  }

  // Tags validation
  const tagsValidation = validateNodeTags(data.tags);
  if (!tagsValidation.isValid && tagsValidation.error) {
    errors.push(tagsValidation.error);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function canMoveNode(
  nodeId: NodeId,
  targetParentId: NodeId,
  getAncestors: (id: NodeId) => NodeId[]
): boolean {
  // Cannot move to itself
  if (nodeId === targetParentId) {
    return false;
  }

  // Cannot move to descendant
  const targetAncestors = getAncestors(targetParentId);
  if (targetAncestors.includes(nodeId)) {
    return false;
  }

  return true;
}

/**
 * Validate external URL format and protocol
 */
export const validateExternalURL = (url: string): { isValid: boolean; error?: string } => {
  try {
    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { isValid: false, error: 'URL must use HTTP or HTTPS protocol' };
    }
    return { isValid: true };
  } catch {
    return { isValid: false, error: 'Invalid URL format' };
  }
};
