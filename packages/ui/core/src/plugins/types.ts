import type { NodeId } from '@hierarchidb/common-core';
import type React from 'react';

/**
 * UI Plugin Definition Interface
 *
 * Standardized interface for all UI plugins in the HierarchiDB system.
 * This interface unifies the handling of all node types (folders, entities) in the UI layer.
 */
export interface UIPluginDefinition {
  // Basic Information
  readonly nodeType: string;
  readonly displayName: string;
  readonly description?: string;

  // Data Source Configuration
  readonly dataSource: {
    // Whether this node type requires entity data (false for folders, true for maps)
    readonly requiresEntity: boolean;
    // Entity type for entity-based nodes
    readonly entityType?: string;
  };

  // Capability Flags
  readonly capabilities: {
    readonly canCreate: boolean;
    readonly canRead: boolean;
    readonly canUpdate: boolean;
    readonly canDelete: boolean;
    readonly canHaveChildren: boolean;
    readonly canMove: boolean;
    readonly supportsWorkingCopy: boolean;
    readonly supportsVersioning: boolean;
    readonly supportsExport: boolean;
    readonly supportsBulkOperations: boolean;
  };

  // UI Components
  readonly components: {
    readonly icon: React.ComponentType<any>;
    readonly createDialog?: React.ComponentType<CreateDialogProps>;
    readonly editDialog?: React.ComponentType<EditDialogProps>;
    readonly detailPanel?: React.ComponentType<DetailPanelProps>;
    readonly tableCell?: React.ComponentType<TableCellProps>;
    readonly preview?: React.ComponentType<PreviewProps>;
  };

  // Action Hooks for CRUD Operations
  readonly hooks: UIActionHooks;

  // Menu and Display Settings
  readonly menu: {
    readonly createOrder: number;
    readonly group: 'basic' | 'container' | 'document' | 'advanced';
    readonly contextMenuItems?: readonly ContextMenuItem[];
  };

  // Visual Styling
  readonly style?: {
    readonly primaryColor?: string;
    readonly icon?: string;
    readonly rowStyle?: React.CSSProperties;
  };
}

/**
 * UI Action Hooks Interface
 *
 * Defines lifecycle hooks for CRUD operations in the UI layer.
 * These hooks allow plugins to customize behavior at different stages.
 */
export interface UIActionHooks {
  // Create Hooks
  beforeShowCreateDialog?: (
    params: BeforeShowCreateDialogParams
  ) => Promise<BeforeShowCreateDialogResult>;
  onShowCreateDialog?: (params: ShowCreateDialogParams) => Promise<void>;
  onValidateCreateForm?: (params: ValidateCreateFormParams) => Promise<ValidateCreateFormResult>;
  afterCreate?: (params: AfterCreateParams) => Promise<AfterCreateResult>;

  // Read Hooks
  onFormatDisplay?: (params: FormatDisplayParams) => Promise<string | React.ReactNode | null>;
  onGeneratePreview?: (params: GeneratePreviewParams) => Promise<React.ComponentType<PreviewProps>>;

  // Update Hooks
  beforeStartEdit?: (params: BeforeStartEditParams) => Promise<BeforeStartEditResult>;
  onShowEditDialog?: (params: ShowEditDialogParams) => Promise<void>;
  afterUpdate?: (params: AfterUpdateParams) => Promise<AfterUpdateResult>;

  // Delete Hooks
  beforeDelete?: (params: BeforeDeleteParams) => Promise<BeforeDeleteResult>;
  afterDelete?: (params: AfterDeleteParams) => Promise<AfterDeleteResult>;

  // Other Hooks
  onContextMenu?: (params: ContextMenuParams) => Promise<readonly ContextMenuItem[]>;
  onExport?: (params: ExportParams) => Promise<Blob>;
  onDragStart?: (params: DragStartParams) => Promise<DragStartResult>;
  onDrop?: (params: DropParams) => Promise<DropResult>;
}

// Hook Parameter Types
export interface BeforeShowCreateDialogParams {
  readonly parentId: NodeId;
  readonly nodeType: string;
  readonly context: UIContext;
}

export interface BeforeShowCreateDialogResult {
  readonly proceed: boolean;
  readonly modifiedParams?: any;
  readonly message?: string;
}

export interface ShowCreateDialogParams {
  readonly parentId: NodeId;
  readonly nodeType: string;
  readonly onSubmit: (data: any) => Promise<void>;
  readonly onCancel: () => void;
}

export interface ValidateCreateFormParams {
  readonly formData: any;
  readonly parentId: NodeId;
}

export interface ValidateCreateFormResult {
  readonly valid: boolean;
  readonly errors?: Record<string, string>;
  readonly warnings?: readonly string[];
}

export interface AfterCreateParams {
  readonly nodeId: NodeId;
  readonly data: any;
  readonly parentId: NodeId;
}

export interface AfterCreateResult {
  readonly navigateTo?: NodeId;
  readonly showMessage?: string;
  readonly refreshNodes?: readonly NodeId[];
}

export interface FormatDisplayParams {
  readonly data: any;
  readonly field: string;
  readonly viewType: 'table' | 'detail' | 'preview';
}

export interface GeneratePreviewParams {
  readonly nodeId: NodeId;
  readonly data: any;
}

export interface BeforeStartEditParams {
  readonly nodeId: NodeId;
  readonly currentData: any;
  readonly editMode: 'inline' | 'dialog' | 'panel';
}

export interface BeforeStartEditResult {
  readonly proceed: boolean;
  readonly readOnlyFields?: readonly string[];
  readonly editableFields?: readonly string[];
  readonly message?: string;
}

export interface ShowEditDialogParams {
  readonly nodeId: NodeId;
  readonly currentData: any;
  readonly onSubmit: (changes: any) => Promise<void>;
  readonly onCancel: () => void;
}

export interface AfterUpdateParams {
  readonly nodeId: NodeId;
  readonly changes: any;
  readonly updatedData: any;
}

export interface AfterUpdateResult {
  readonly refreshNodes?: readonly NodeId[];
  readonly showMessage?: string;
}

export interface BeforeDeleteParams {
  readonly nodeIds: readonly NodeId[];
  readonly entities: readonly any[];
  readonly hasChildren: boolean;
}

export interface BeforeDeleteResult {
  readonly proceed: boolean;
  readonly confirmMessage?: string;
  readonly showChildrenWarning?: boolean;
}

export interface AfterDeleteParams {
  readonly deletedNodeIds: readonly NodeId[];
  readonly parentIds: readonly NodeId[];
}

export interface AfterDeleteResult {
  readonly navigateTo?: NodeId;
  readonly showMessage?: string;
  readonly refreshNodes?: readonly NodeId[];
}

export interface ContextMenuParams {
  readonly nodeId: NodeId;
  readonly data: any;
  readonly mousePosition: { readonly x: number; readonly y: number };
}

export interface ExportParams {
  readonly nodeIds: readonly NodeId[];
  readonly format: string;
}

export interface DragStartParams {
  readonly nodeId: NodeId;
  readonly data: any;
}

export interface DragStartResult {
  readonly proceed: boolean;
  readonly dragImage?: HTMLElement;
}

export interface DropParams {
  readonly draggedNodeId: NodeId;
  readonly targetNodeId: NodeId;
  readonly position: 'before' | 'after' | 'inside';
}

export interface DropResult {
  readonly proceed: boolean;
  readonly confirmMessage?: string;
}

// Component Props Types
export interface CreateDialogProps {
  readonly parentId: NodeId;
  readonly onSubmit: (data: any) => Promise<void>;
  readonly onCancel: () => void;
  readonly open?: boolean;
}

export interface EditDialogProps {
  readonly nodeId: NodeId;
  readonly currentData: any;
  readonly onSubmit: (changes: any) => Promise<void>;
  readonly onCancel: () => void;
  readonly open?: boolean;
}

export interface DetailPanelProps {
  readonly nodeId: NodeId;
  readonly data: any;
  readonly onUpdate?: (changes: any) => Promise<void>;
}

export interface TableCellProps {
  readonly nodeId: NodeId;
  readonly data: any;
  readonly field: string;
  readonly value: any;
}

export interface PreviewProps {
  readonly nodeId: NodeId;
  readonly data: any;
  readonly readonly?: boolean;
}

// Supporting Types
export interface ContextMenuItem {
  readonly label: string;
  readonly icon?: string;
  readonly action?: () => void;
  readonly type?: 'item' | 'divider';
  readonly disabled?: boolean;
  readonly submenu?: readonly ContextMenuItem[];
}

export interface UIContext {
  readonly userId?: string;
  readonly permissions?: readonly string[];
  readonly currentPath?: NodeId[];
  readonly selectedNodes?: readonly NodeId[];
  readonly theme?: 'light' | 'dark';
  readonly locale?: string;
}

// Data Types
export interface UnifiedNodeData {
  readonly treeNode: any; // TreeNode from worker
  readonly entity: any | null; // Entity data if required
  readonly combinedData: any; // Combined data for UI consumption
}

export interface CreateMenuItem {
  readonly nodeType?: string;
  readonly label?: string;
  readonly description?: string;
  readonly icon?: React.ComponentType<any>;
  readonly group?: string;
  readonly order?: number;
  readonly onClick?: () => void;
  readonly type?: 'item' | 'divider';
}
