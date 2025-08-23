# Common Validation Patterns

## Overview

HierarchiDB provides common validation functions in the `@hierarchidb/core` package to ensure consistent validation across all plugins and node types.

## Core Validation Functions

### Node Name Validation

```typescript
import { validateNodeName } from '@hierarchidb/core';

const result = validateNodeName('My Folder');
// Returns: { isValid: true }

const invalid = validateNodeName('');
// Returns: { isValid: false, error: 'Name is required' }
```

**Validation Rules:**
- Required (non-empty)
- Maximum 255 characters
- No file system reserved characters: `< > : " / \ | ? *`
- Trimmed whitespace

### Node Description Validation

```typescript
import { validateNodeDescription } from '@hierarchidb/core';

const result = validateNodeDescription('This is a description');
// Returns: { isValid: true }

const invalid = validateNodeDescription('a'.repeat(1001));
// Returns: { isValid: false, error: 'Description must not exceed 1000 characters' }
```

**Validation Rules:**
- Optional
- Maximum 1000 characters
- Trimmed whitespace

### Node Tags Validation

```typescript
import { validateNodeTags } from '@hierarchidb/core';

const result = validateNodeTags(['tag1', 'tag2']);
// Returns: { isValid: true }

const invalid = validateNodeTags(['tag1', 'tag2', 'tag3', ...more than 10]);
// Returns: { isValid: false, error: 'Maximum 10 tags allowed' }
```

**Validation Rules:**
- Optional array
- Maximum 10 tags
- Each tag must be a string with max 50 characters
- Tags are trimmed

### Combined Validation

```typescript
import { validateCommonNodeData } from '@hierarchidb/core';

const result = validateCommonNodeData({
  name: 'My Node',
  description: 'A description',
  tags: ['important', 'resource']
});
// Returns: { isValid: true, errors: [] }
```

## Usage in Plugins

### In Plugin Lifecycle Hooks

```typescript
import { validateNodeName, validateNodeDescription } from '@hierarchidb/core';

const myPluginLifecycle: NodeLifecycleHooks = {
  beforeCreate: async (_parentId: NodeId, nodeData: Partial<MyEntity>) => {
    // Validate common properties
    if (nodeData.name !== undefined) {
      const nameValidation = validateNodeName(nodeData.name);
      if (!nameValidation.isValid) {
        throw new Error(nameValidation.error || 'Invalid node name');
      }
    }
    
    if (nodeData.description !== undefined) {
      const descValidation = validateNodeDescription(nodeData.description);
      if (!descValidation.isValid) {
        throw new Error(descValidation.error || 'Invalid node description');
      }
    }
    
    // Plugin-specific validation...
  }
};
```

### In UI Components

```typescript
import { validateNodeName } from '@hierarchidb/core';
import { useState } from 'react';

function NodeNameInput() {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  
  const handleChange = (value: string) => {
    setName(value);
    const validation = validateNodeName(value);
    setError(validation.isValid ? '' : validation.error || '');
  };
  
  return (
    <TextField
      value={name}
      onChange={(e) => handleChange(e.target.value)}
      error={Boolean(error)}
      helperText={error}
      label="Node Name"
    />
  );
}
```

### In Worker Handlers

```typescript
import { validateCommonNodeData } from '@hierarchidb/core';

class MyEntityHandler extends BaseEntityHandler<MyEntity> {
  async createEntity(nodeId: NodeId, data: Partial<MyEntity>): Promise<MyEntity> {
    // Validate common data
    const validation = validateCommonNodeData({
      name: data.name,
      description: data.description,
      tags: data.tags
    });
    
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }
    
    // Create entity...
  }
}
```

## Advanced Validation with ui-validation Package

For more complex validation scenarios, use the `@hierarchidb/ui-validation` package:

```typescript
import { useNodeValidation } from '@hierarchidb/ui-validation';

function MyForm() {
  const validation = useNodeValidation(nodeName, {
    parentNodeId: parentId,
    nodeId: currentNodeId,
    getSiblingNodes: async (parentId) => {
      // Fetch siblings for uniqueness check
    }
  });
  
  return (
    <TextField
      value={nodeName}
      onChange={(e) => setNodeName(e.target.value)}
      error={!validation.isValid}
      helperText={validation.errors[0]?.message}
    />
  );
}
```

## Migration Guide

### From Plugin-Specific Validation

**Before:**
```typescript
// In folder plugin
function validateFolderName(name: string): { isValid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { isValid: false, error: 'Folder name is required' };
  }
  // ... custom validation logic
}
```

**After:**
```typescript
// Use common validation
import { validateNodeName } from '@hierarchidb/core';

// Direct usage
const result = validateNodeName(folderName);

// Or extend for plugin-specific needs
function validateFolderData(data: FolderData) {
  const commonValidation = validateCommonNodeData(data);
  
  // Add folder-specific validation
  if (data.someSpecificField && !isValidSpecificField(data.someSpecificField)) {
    commonValidation.errors.push('Specific field is invalid');
    commonValidation.isValid = false;
  }
  
  return commonValidation;
}
```

## Best Practices

1. **Always validate at multiple layers:**
   - UI layer: Immediate user feedback
   - Worker layer: Security and data integrity
   - Database layer: Final validation before persistence

2. **Use common validation first:**
   - Apply common validation for name, description, tags
   - Then add plugin-specific validation

3. **Provide clear error messages:**
   - Use the error messages from validation results
   - Add context when needed

4. **Handle optional fields properly:**
   - Only validate if field is defined
   - Don't require optional fields

5. **Consider performance:**
   - Use debouncing for real-time validation
   - Cache validation results when appropriate

## Type Definitions

```typescript
// From @hierarchidb/core
export interface CommonValidationResult {
  isValid: boolean;
  error?: string;
}

export interface CommonNodeData {
  name?: string;
  description?: string;
  tags?: string[];
}

export interface CommonValidationErrors {
  isValid: boolean;
  errors: string[];
}
```

## Future Enhancements

- **Async validation**: Support for async validation (e.g., uniqueness checks)
- **Custom validation rules**: Plugin-defined validation rules registry
- **i18n support**: Localized error messages
- **Validation schemas**: JSON Schema or Zod integration
- **Field-level validation**: More granular validation with field paths