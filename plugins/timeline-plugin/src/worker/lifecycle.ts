// Worker lifecycle descriptor for timeline nodes (special folder behavior)
export const lifecycle = {
  nodeType: 'timeline',
  capabilities: {
    canHaveChildren: true,
    canBeRoot: false,
    canBeDeleted: true,
    canBeRenamed: true,
    canBeMoved: true,
  },
} as const;

