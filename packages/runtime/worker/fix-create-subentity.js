const fs = require('fs');
const path = require('path');

// Read SubEntityHandler.test.ts
const filePath = path.join(__dirname, 'src/handlers/SubEntityHandler.test.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Counter for unique IDs
let idCounter = 1;

// Replace simple createSubEntity calls with full objects
content = content.replace(
  /await handler\.createSubEntity\(([^,]+), '([^']+)', \{\s*name: '([^']+)'(?:,\s*data: ([^}]+))?\s*\}\)/g,
  (match, nodeId, type, name, data) => {
    const id = `sub-${idCounter++}`;
    const dataStr = data ? `, data: ${data}` : ', data: {}';
    return `await handler.createSubEntity(${nodeId}, '${type}', {
          id: '${id}' as EntityId,
          nodeId: ${nodeId},
          parentNodeId: ${nodeId},
          type: '${type}',
          subEntityType: '${type}',
          name: '${name}'${dataStr},
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        } as ExtendedSubEntity)`;
  }
);

fs.writeFileSync(filePath, content);
console.log('Fixed createSubEntity calls in SubEntityHandler.test.ts');
