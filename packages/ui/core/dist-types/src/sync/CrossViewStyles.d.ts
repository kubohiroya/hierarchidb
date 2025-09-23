/**
 * CrossViewStyles
 *
 * 行（RowId）と地図フィーチャ（FeatureId）へ同一のスタイルモデル（StyleId → StyleSpec）を適用し、
 * 「ホバー／選択／検索マッチ／無効化／ドラッグ／ドロップターゲット」等の視覚状態を相互同期するための軽量コントローラです。
 *
 * - datasetId ごとにチャネルを分離します（例: `shape:table-123`）。
 * - 行⇔フィーチャのマッピング（1:n / n:n）を保持し、片側の状態変更をもう片側へ反映します。
 * - スタイル辞書（Map<StyleId,StyleSpec>）は表用(row)と地図用(map)の両表現を持てます。priority により競合解消が可能です。
 * - deck.gl/MapLibreGL への適用を補助するアクセサ/feature-state 更新関数を提供します。
 * - フォーカスイベント（hover/selection 時に付帯情報を Snackbar へ表示する等）を publish/subscribe できます。
 *
 * 典型的な利用手順:
 * 1) CrossViewStyles.setMapping(datasetId, [{ rowId, featureIds }...])
 * 2) CrossViewStyles.setStyles(datasetId, new Map([[styleId, styleSpec], ...]))
 * 3) CrossViewStyles.assignRows/assignFeatures で batch 割当 or setState() で状態更新（hover/selected/matched 等）
 * 4) 表: DataGrid から onRowHover などで setState() + emitFocus()
 * 5) 地図: deck.gl の onHover / MapLibre の mousemove を受けて setState() + emitFocus()
 * 6) CrossViewSnackbar を配置して subscribeFocus() でイベントを受け取り表示
 */
export type Id = string | number;
export type DatasetId = string;
export type VisualState = 'hovered' | 'selected' | 'matched' | 'disabled' | 'dragging' | 'dropTarget';
export interface RowStyleSpec {
    sx?: Record<string, any>;
    style?: React.CSSProperties;
    className?: string;
}
export interface MapStyleSpec {
    fillColor?: [number, number, number, number];
    lineColor?: [number, number, number, number];
    lineWidth?: number;
    elevation?: number;
    featureState?: Record<string, any>;
}
export type ComposeMode = 'override' | 'merge';
export interface StyleSpec {
    row?: RowStyleSpec;
    map?: MapStyleSpec;
    priority?: number;
    composeMode?: ComposeMode;
}
export type StyleId = string;
export interface CrossStyleRegistry {
    styles: Map<StyleId, StyleSpec>;
    rowAssignments: Map<StyleId, Set<Id>>;
    featureAssignments: Map<StyleId, Set<Id>>;
}
export interface Mapping {
    rowToFeatures: Map<Id, Set<Id>>;
    featureToRows: Map<Id, Set<Id>>;
}
export interface FocusEventPayload {
    datasetId: DatasetId;
    source: 'row' | 'feature';
    id: Id;
    data?: any;
}
export declare const CrossViewStyles: {
    /**
     * 視覚状態の変更通知（表/地図の再描画など）を購読します。
     * @param datasetId チャネル識別子
     * @param cb 状態変更時に呼ばれるコールバック
     * @returns 解除関数
     */
    subscribe(datasetId: DatasetId, cb: () => void): () => void;
    /**
     * フォーカスイベント（hover/selection に紐づく詳細情報）を購読します。
     * @param datasetId チャネル識別子
     * @param cb フォーカス発生/解除で呼ばれる（解除時は null）
     * @returns 解除関数
     */
    subscribeFocus(datasetId: DatasetId, cb: (ev: FocusEventPayload | null) => void): () => void;
    /**
     * 行IDとフィーチャIDの対応付けをセットします（1:n / n:n いずれも可）。
     */
    setMapping(datasetId: DatasetId, pairs: Array<{
        rowId: Id;
        featureIds: Id[];
    }>): void;
    /**
     * 行/フィーチャの状態集合を更新します。hovered/selected/matched は相互側へも反映されます。
     */
    setState(datasetId: DatasetId, which: "rows" | "features", state: VisualState, ids: Set<Id>): void;
    /**
     * スタイル辞書（StyleId→StyleSpec）を設定します。priority の大きい StyleSpec が優先されます。
     */
    setStyles(datasetId: DatasetId, styles: Map<StyleId, StyleSpec>): void;
    hasStyles(datasetId: DatasetId): boolean;
    assignRows(datasetId: DatasetId, styleId: StyleId, ids: Set<Id>): void;
    assignFeatures(datasetId: DatasetId, styleId: StyleId, ids: Set<Id>): void;
    getRowSets(datasetId: DatasetId): {
        hovered: Set<Id>;
        selected: Set<Id>;
        matched: Set<Id>;
        disabled: Set<Id>;
        dragging: Set<Id>;
        dropTarget: Set<Id>;
    };
    /**
     * 行に適用される StyleSpec.row の最終形を返します（priority で競合解消後）。
     */
    resolveRowStyle(datasetId: DatasetId, rowId: Id): RowStyleSpec | undefined;
    /**
     * deck.gl 用のアクセサ（getFillColor/getLineColor/getLineWidth/getElevation）を返します。
     * Feature の id フィールドを参照してスタイル辞書から最終値を解決します。
     */
    getDeckAccessors(datasetId: DatasetId): {
        getFillColor: (d: any) => [number, number, number, number];
        getLineColor: (d: any) => [number, number, number, number];
        getLineWidth: (d: any) => number;
        getElevation: (d: any) => number;
    };
    /**
     * MapLibre の feature-state をスタイル辞書にもとづいて一括更新します。
     * paint/line-paint の式側で ['feature-state','selected'] などを参照してください。
     */
    applyMapLibreFeatureState(datasetId: DatasetId, map: any, sourceId: string): void;
    /** フォーカスイベントを発火（Snackbar などで利用） */
    emitFocus(datasetId: DatasetId, payload: FocusEventPayload): void;
    emitBlur(datasetId: DatasetId): void;
};
//# sourceMappingURL=CrossViewStyles.d.ts.map