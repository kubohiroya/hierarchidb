/**
 * @file ResourceProjectPreviewGroup.tsx
 * @description Unified button group for Resources, Projects, and PreviewStep navigation
 */
export type ResourceProjectType = 'resources' | 'projects';
export type ButtonGroupOrientation = 'horizontal' | 'vertical';
export type ButtonGroupSize = 'small' | 'medium' | 'large';
interface ResourceProjectPreviewGroupProps {
    /** Currently selected type */
    selected: ResourceProjectType;
    /** Current pageNodeId to preserve */
    currentPageNodeId?: string;
    /** App prefix for routing (optional, only needed if not using React Router basename) */
    appPrefix?: string;
    /** Callback to get saved pageNodeId for a given type */
    getSavedPageNodeId: (type: ResourceProjectType) => string | null;
    /** Callback to save pageNodeId for a given type */
    savePageNodeId: (type: ResourceProjectType, pageNodeId: string) => void;
    /** Whether preview button is enabled */
    previewEnabled?: boolean;
    /** Callback when preview is clicked */
    onPreviewClick?: () => void;
    /** Button group orientation - horizontal (default) or vertical */
    orientation?: ButtonGroupOrientation;
    /** Button size - small, medium (default), or large */
    size?: ButtonGroupSize;
}
export declare function ResourceProjectPreviewGroup({ selected, currentPageNodeId, appPrefix, getSavedPageNodeId, savePageNodeId, previewEnabled, onPreviewClick, orientation, size, }: ResourceProjectPreviewGroupProps): JSX.Element;
export {};
//# sourceMappingURL=ResourceProjectPreviewGroup.d.ts.map