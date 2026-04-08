/**
 * Pure function to build create menu items from explicit list, global builders, or default fallback.
 * Extracted from useNodeContextMenu.ts IIFE for reuse across NodeContextMenu and BackgroundContextMenu.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Input format matching the element type of NodeContextMenuProps.createItems. */
export interface CreateMenuEntryInput {
    type: string;
    createType?: string;
    label: string;
    labelKey?: string;
    description?: string;
    descriptionKey?: string;
    icon?: { muiIconName?: string; emoji?: string; color?: string };
    children?: CreateMenuEntryInput[];
}

/** Normalised menu entry used by both NodeContextMenu and BackgroundContextMenu. */
export type CreateMenuEntry = {
    key: string;
    nodeType: string;
    createType?: string;
    label: string;
    labelKey?: string;
    description?: string;
    descriptionKey?: string;
    icon?: { muiIconName?: string; emoji?: string; color?: string };
    children?: CreateMenuEntry[];
};

// ---------------------------------------------------------------------------
// Internal types (not exported)
// ---------------------------------------------------------------------------

type CreateMenuBuilder = (treeId?: string) => CreateMenuEntry[];
type GlobalMenuBuilders = {
    buildMenuItemsForTreeId?: CreateMenuBuilder;
    buildMenuItemsForContext?: CreateMenuBuilder;
};

// ---------------------------------------------------------------------------
// Internal logger
// ---------------------------------------------------------------------------

const logBuildCreateMenuWarning = (message: string, error: unknown): void => {
    if (typeof console === 'undefined') return;
    console.warn('[buildCreateMenuItems]', message, error);
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build create menu items from one of three sources (checked in order):
 *
 * 1. Explicit `createItems` array (mapped to CreateMenuEntry format)
 * 2. `globalThis.__HDB_MENU_BUILDERS__` lookup (builder called with treeId)
 * 3. Default fallback (folder + note)
 *
 * The GlobalMenuBuilders call is wrapped in try/catch — on failure the default
 * fallback is returned and a warning is logged.
 */
export function buildCreateMenuItems(
    createItems: CreateMenuEntryInput[] | undefined,
    treeId: string | undefined,
): CreateMenuEntry[] {
    // Source 1: explicit createItems prop
    if (createItems?.length) {
        return createItems.map((item) => ({
            key: item.createType ?? item.type,
            nodeType: item.type,
            createType: item.createType,
            label: item.label,
            labelKey: item.labelKey,
            description: item.description,
            descriptionKey: item.descriptionKey,
            icon: item.icon,
            children: (item.children ?? []).map((child) => ({
                key: child.createType ?? child.type,
                nodeType: child.type,
                createType: child.createType,
                label: child.label,
                labelKey: child.labelKey,
                description: child.description,
                descriptionKey: child.descriptionKey,
                icon: child.icon,
            })),
        }));
    }

    // Source 2: GlobalMenuBuilders lookup
    try {
        const g = (globalThis as { __HDB_MENU_BUILDERS__?: GlobalMenuBuilders }).__HDB_MENU_BUILDERS__;
        const builder: CreateMenuBuilder | undefined = g?.buildMenuItemsForTreeId || g?.buildMenuItemsForContext;
        if (typeof builder === 'function') {
            const items = builder(treeId) as CreateMenuEntry[];
            return (items || []).map((item) => ({
                key: item.key ?? (item.createType ?? item.nodeType),
                nodeType: item.nodeType,
                createType: item.createType,
                label: item.label,
                labelKey: item.labelKey,
                description: item.description,
                descriptionKey: item.descriptionKey,
                icon: item.icon,
                children: (item.children ?? []).map((child) => ({
                    key: child.key ?? (child.createType ?? child.nodeType),
                    nodeType: child.nodeType,
                    createType: child.createType,
                    label: child.label,
                    labelKey: child.labelKey,
                    description: child.description,
                    descriptionKey: child.descriptionKey,
                    icon: child.icon,
                })),
            }));
        }
    } catch (error) {
        logBuildCreateMenuWarning('Failed to stage dynamic create menu items', error);
    }

    // Source 3: default fallback
    return [
        { key: 'folder', nodeType: 'folder', label: 'Folder', description: undefined, icon: { muiIconName: 'Folder' } },
        { key: 'note', nodeType: 'note', label: 'Note', description: undefined, icon: { muiIconName: 'Extension' } },
    ];
}
