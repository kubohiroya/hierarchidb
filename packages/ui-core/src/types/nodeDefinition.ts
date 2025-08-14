import type {
  TreeNodeId,
  TreeNodeType,
  NodeTypeDefinition,
  BaseEntity,
  BaseSubEntity,
  BaseWorkingCopy,
  ValidationErrors,
} from '@hierarchidb/core';

// UIコンポーネントのプロパティ
export interface NodeDialogProps<TEntity extends BaseEntity = BaseEntity> {
  nodeId?: TreeNodeId;
  nodeType: TreeNodeType;
  onClose: () => void;
  onSave?: (data: Partial<TEntity>) => Promise<void>;
}

export interface NodePanelProps {
  nodeId: TreeNodeId;
  readonly?: boolean;
}

export interface NodeFormProps<TEntity extends BaseEntity = BaseEntity> {
  entity: TEntity;
  onChange: (entity: Partial<TEntity>) => void;
  errors?: ValidationErrors<TEntity>;
}

// UI拡張を含むNodeTypeDefinition
export interface UINodeTypeDefinition<
  TEntity extends BaseEntity = BaseEntity,
  TSubEntity extends BaseSubEntity = BaseSubEntity,
  TWorkingCopy extends BaseWorkingCopy = BaseWorkingCopy,
> extends NodeTypeDefinition<TEntity, TSubEntity, TWorkingCopy> {
  // UI設定
  readonly ui?: {
    dialogComponent?: React.ComponentType<NodeDialogProps<TEntity>>;
    panelComponent?: React.ComponentType<NodePanelProps>;
    formComponent?: React.ComponentType<NodeFormProps<TEntity>>;
    iconComponent?: React.ComponentType<{ size?: number; color?: string }>;
  };
}

// UI層のNodeTypeRegistry
export class UINodeTypeRegistry {
  private static instance: UINodeTypeRegistry;
  private uiDefinitions: Map<
    TreeNodeType,
    UINodeTypeDefinition<BaseEntity, BaseSubEntity, BaseWorkingCopy>
  > = new Map();

  private constructor() {}

  static getInstance(): UINodeTypeRegistry {
    if (!UINodeTypeRegistry.instance) {
      UINodeTypeRegistry.instance = new UINodeTypeRegistry();
    }
    return UINodeTypeRegistry.instance;
  }

  registerUI<
    TEntity extends BaseEntity,
    TSubEntity extends BaseSubEntity,
    TWorkingCopy extends BaseWorkingCopy,
  >(definition: UINodeTypeDefinition<TEntity, TSubEntity, TWorkingCopy>): void {
    const { nodeType } = definition;

    if (this.uiDefinitions.has(nodeType)) {
      throw new Error(`UI definition for node type ${nodeType} is already registered`);
    }

    this.uiDefinitions.set(
      nodeType,
      definition as unknown as UINodeTypeDefinition<BaseEntity, BaseSubEntity, BaseWorkingCopy>
    );
  }

  unregisterUI(nodeType: TreeNodeType): void {
    this.uiDefinitions.delete(nodeType);
  }

  getUIDefinition(
    nodeType: TreeNodeType
  ): UINodeTypeDefinition<BaseEntity, BaseSubEntity, BaseWorkingCopy> | undefined {
    return this.uiDefinitions.get(nodeType);
  }

  getAllUIDefinitions(): UINodeTypeDefinition<BaseEntity, BaseSubEntity, BaseWorkingCopy>[] {
    return Array.from(this.uiDefinitions.values());
  }

  hasUIDefinition(nodeType: TreeNodeType): boolean {
    return this.uiDefinitions.has(nodeType);
  }
}

// 便利な合成関数
export function createUINodeTypeDefinition<
  TEntity extends BaseEntity = BaseEntity,
  TSubEntity extends BaseSubEntity = BaseSubEntity,
  TWorkingCopy extends BaseWorkingCopy = BaseWorkingCopy,
>(
  coreDefinition: NodeTypeDefinition<TEntity, TSubEntity, TWorkingCopy>,
  uiExtensions: {
    dialogComponent?: React.ComponentType<NodeDialogProps<TEntity>>;
    panelComponent?: React.ComponentType<NodePanelProps>;
    formComponent?: React.ComponentType<NodeFormProps<TEntity>>;
    iconComponent?: React.ComponentType<{ size?: number; color?: string }>;
  }
): UINodeTypeDefinition<TEntity, TSubEntity, TWorkingCopy> {
  return {
    ...coreDefinition,
    ui: uiExtensions,
  };
}
