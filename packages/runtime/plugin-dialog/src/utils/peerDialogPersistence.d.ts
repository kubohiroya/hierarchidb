export type PeerDisplayMode = 'normal' | 'maximize' | 'full-screen';
export type PeerDialogPosition = {
    x: number;
    y: number;
};
export type PeerDialogSize = {
    width: number;
    height: number;
};
export interface PeerDialogPersistence {
    getDisplayMode(nodeId: string): Promise<PeerDisplayMode | null>;
    setDisplayMode(nodeId: string, mode: PeerDisplayMode): Promise<void>;
    getPosition(nodeId: string): Promise<PeerDialogPosition | null>;
    setPosition(nodeId: string, pos: PeerDialogPosition): Promise<void>;
    getSize(nodeId: string): Promise<PeerDialogSize | null>;
    setSize(nodeId: string, size: PeerDialogSize): Promise<void>;
    copyState?(fromNodeId: string, toNodeId: string): Promise<void>;
}
declare global {
    var __HDB_PLUGIN_ENTITY_OVERRIDES__: Record<string, unknown> | undefined;
}
declare class UIPersistenceRegistry {
    private providers;
    private dbCache;
    register(nodeType: string, provider: PeerDialogPersistence): void;
    get(nodeType: string): PeerDialogPersistence;
    private noopProvider;
    private createDefaultProvider;
}
export declare const UIPersistence: UIPersistenceRegistry;
export declare const getPeerDisplayMode: (nodeType: string, nodeId: string) => Promise<PeerDisplayMode | null>;
export declare const setPeerDisplayMode: (nodeType: string, nodeId: string, mode: PeerDisplayMode) => Promise<void>;
export declare const getPeerDialogPosition: (nodeType: string, nodeId: string) => Promise<PeerDialogPosition | null>;
export declare const setPeerDialogPosition: (nodeType: string, nodeId: string, pos: PeerDialogPosition) => Promise<void>;
export declare const getPeerDialogSize: (nodeType: string, nodeId: string) => Promise<PeerDialogSize | null>;
export declare const setPeerDialogSize: (nodeType: string, nodeId: string, size: PeerDialogSize) => Promise<void>;
export {};
//# sourceMappingURL=peerDialogPersistence.d.ts.map