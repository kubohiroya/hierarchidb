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

const logCrossViewWarning = (message: string, error: unknown): void => {
  if (typeof console === 'undefined') return;
  console.warn('[CrossViewStyles]', message, error);
};

export interface RowStyleSpec { sx?: Record<string, any>; style?: React.CSSProperties; className?: string }
export interface MapStyleSpec { fillColor?: [number,number,number,number]; lineColor?: [number,number,number,number]; lineWidth?: number; elevation?: number; featureState?: Record<string, any> }
export type ComposeMode = 'override' | 'merge';
export interface StyleSpec { row?: RowStyleSpec; map?: MapStyleSpec; priority?: number; composeMode?: ComposeMode }
export type StyleId = string;

export interface CrossStyleRegistry {
  styles: Map<StyleId, StyleSpec>;
  rowAssignments: Map<StyleId, Set<Id>>;
  featureAssignments: Map<StyleId, Set<Id>>;
}
export interface Mapping { rowToFeatures: Map<Id, Set<Id>>; featureToRows: Map<Id, Set<Id>> }

export interface FocusEventPayload {
  datasetId: DatasetId;
  source: 'row'|'feature';
  id: Id;
  data?: any; // name/type/description/coordinates etc.
}

interface ChannelState {
  rows: Record<VisualState, Set<Id>>;
  features: Record<VisualState, Set<Id>>;
  mapping: Mapping;
  registry: CrossStyleRegistry;
  listeners: Set<() => void>;
  focusListeners: Set<(ev: FocusEventPayload | null) => void>;
  focus: FocusEventPayload | null;
}

const channels = new Map<DatasetId, ChannelState>();
const emptySets = () => ({ hovered:new Set<Id>(), selected:new Set<Id>(), matched:new Set<Id>(), disabled:new Set<Id>(), dragging:new Set<Id>(), dropTarget:new Set<Id>() });
function makeState(): ChannelState { return { rows:emptySets(), features:emptySets(), mapping:{rowToFeatures:new Map(), featureToRows:new Map()}, registry:{styles:new Map(), rowAssignments:new Map(), featureAssignments:new Map()}, listeners:new Set(), focusListeners:new Set(), focus:null }; }
function getCh(id: DatasetId) { let ch = channels.get(id); if(!ch){ ch=makeState(); channels.set(id,ch);} return ch; }

export const CrossViewStyles = {
  /**
   * 視覚状態の変更通知（表/地図の再描画など）を購読します。
   * @param datasetId チャネル識別子
   * @param cb 状態変更時に呼ばれるコールバック
   * @returns 解除関数
   */
  subscribe(datasetId: DatasetId, cb: () => void) {
    const ch = getCh(datasetId);
    ch.listeners.add(cb);
    return () => {
      ch.listeners.delete(cb);
    };
  },
  /**
   * フォーカスイベント（hover/selection に紐づく詳細情報）を購読します。
   * @param datasetId チャネル識別子
   * @param cb フォーカス発生/解除で呼ばれる（解除時は null）
   * @returns 解除関数
   */
  subscribeFocus(datasetId: DatasetId, cb: (ev: FocusEventPayload | null) => void) {
    const ch = getCh(datasetId);
    ch.focusListeners.add(cb);
    return () => {
      ch.focusListeners.delete(cb);
    };
  },

  /**
   * 行IDとフィーチャIDの対応付けをセットします（1:n / n:n いずれも可）。
   */
  setMapping(datasetId: DatasetId, pairs: Array<{ rowId: Id; featureIds: Id[] }>) {
    const ch = getCh(datasetId); ch.mapping.rowToFeatures.clear(); ch.mapping.featureToRows.clear();
    for (const {rowId, featureIds} of pairs) { ch.mapping.rowToFeatures.set(rowId, new Set(featureIds)); for (const fid of featureIds){ const s = ch.mapping.featureToRows.get(fid) || new Set<Id>(); s.add(rowId); ch.mapping.featureToRows.set(fid,s);} }
    ch.listeners.forEach(f=>f());
  },

  /**
   * 行/フィーチャの状態集合を更新します。hovered/selected/matched は相互側へも反映されます。
   */
  setState(datasetId: DatasetId, which: 'rows'|'features', state: VisualState, ids: Set<Id>) {
    const ch = getCh(datasetId); ch[which][state] = new Set(ids);
    if (which==='rows' && (state==='hovered'||state==='selected'||state==='matched')){
      const fids = new Set<Id>(); ids.forEach(rid=>ch.mapping.rowToFeatures.get(rid)?.forEach(fid=>fids.add(fid))); ch.features[state]=fids;
    }
    if (which==='features' && (state==='hovered'||state==='selected'||state==='matched')){
      const rids = new Set<Id>(); ids.forEach(fid=>ch.mapping.featureToRows.get(fid)?.forEach(rid=>rids.add(rid))); ch.rows[state]=rids;
    }
    ch.listeners.forEach(f=>f());
  },

  /**
   * スタイル辞書（StyleId→StyleSpec）を設定します。priority の大きい StyleSpec が優先されます。
   */
  setStyles(datasetId: DatasetId, styles: Map<StyleId, StyleSpec>){ const ch=getCh(datasetId); ch.registry.styles=styles; ch.listeners.forEach(f=>f()); },
  hasStyles(datasetId: DatasetId){ const ch=getCh(datasetId); return (ch.registry.styles?.size||0) > 0; },
  assignRows(datasetId: DatasetId, styleId: StyleId, ids: Set<Id>){ const ch=getCh(datasetId); ch.registry.rowAssignments.set(styleId,new Set(ids)); ch.listeners.forEach(f=>f()); },
  assignFeatures(datasetId: DatasetId, styleId: StyleId, ids: Set<Id>){ const ch=getCh(datasetId); ch.registry.featureAssignments.set(styleId,new Set(ids)); ch.listeners.forEach(f=>f()); },

  getRowSets(datasetId: DatasetId){ const ch=getCh(datasetId); return { hovered:new Set(ch.rows.hovered), selected:new Set(ch.rows.selected), matched:new Set(ch.rows.matched), disabled:new Set(ch.rows.disabled), dragging:new Set(ch.rows.dragging), dropTarget:new Set(ch.rows.dropTarget) }; },

  /**
   * 行に適用される StyleSpec.row の最終形を返します（priority で競合解消後）。
   */
  resolveRowStyle(datasetId: DatasetId, rowId: Id){
    const ch=getCh(datasetId);
    // Collect applicable specs sorted by priority asc
    const specs: Array<{pr:number; spec: StyleSpec}> = [];
    ch.registry.rowAssignments.forEach((ids,sid)=>{ if(!ids.has(rowId)) return; const st=ch.registry.styles.get(sid); if(st?.row) specs.push({ pr: st.priority??0, spec: st}); });
    // Add default state-driven styles if defined
    if (ch.rows.matched.has(rowId)) { const st = ch.registry.styles.get('match'); if (st?.row) specs.push({ pr: st.priority??5, spec: st}); }
    if (ch.rows.hovered.has(rowId)) { const st = ch.registry.styles.get('hover'); if (st?.row) specs.push({ pr: st.priority??10, spec: st}); }
    if (ch.rows.selected.has(rowId)) { const st = ch.registry.styles.get('select'); if (st?.row) specs.push({ pr: st.priority??20, spec: st}); }
    specs.sort((a,b)=>a.pr-b.pr);
    if (specs.length===0) return undefined;
    // If highest composeMode is override (default), return that. If merge exists anywhere, merge all.
    const shouldMerge = specs.some(s => (s.spec.composeMode ?? 'override')==='merge');
    if (!shouldMerge) return specs[specs.length-1]!.spec.row; // top-most
    const merged: RowStyleSpec = {};
    for (const s of specs){
      const r = s.spec.row!;
      merged.sx = { ...(merged.sx||{}), ...(r.sx||{}) };
      merged.style = { ...(merged.style ?? {}), ...(r.style ?? {}) };
      merged.className = [merged.className, r.className].filter(Boolean).join(' ').trim() || undefined;
    }
    return merged;
  },

  /**
   * deck.gl 用のアクセサ（getFillColor/getLineColor/getLineWidth/getElevation）を返します。
   * Feature の id フィールドを参照してスタイル辞書から最終値を解決します。
   */
  getDeckAccessors(datasetId: DatasetId){ const ch=getCh(datasetId); const pick=(fid:Id)=>{
      const specs: Array<{pr:number; spec: StyleSpec}> = [];
      ch.registry.featureAssignments.forEach((ids,sid)=>{ if(!ids.has(fid)) return; const st=ch.registry.styles.get(sid); if(st?.map) specs.push({ pr: st.priority??0, spec: st}); });
      // Add default state-driven styles if defined
      if (ch.features.matched.has(fid)) { const st = ch.registry.styles.get('match'); if (st?.map) specs.push({ pr: st.priority??5, spec: st}); }
      if (ch.features.hovered.has(fid)) { const st = ch.registry.styles.get('hover'); if (st?.map) specs.push({ pr: st.priority??10, spec: st}); }
      if (ch.features.selected.has(fid)) { const st = ch.registry.styles.get('select'); if (st?.map) specs.push({ pr: st.priority??20, spec: st}); }
      specs.sort((a,b)=>a.pr-b.pr);
      if (specs.length===0) return undefined;
      const shouldMerge = specs.some(s => (s.spec.composeMode ?? 'override')==='merge');
      if (!shouldMerge) return specs[specs.length-1]!.spec.map; // top-most
      const merged: MapStyleSpec = {};
      for (const s of specs){
        const m = s.spec.map!;
        Object.assign(merged, m);
        if (m.featureState) merged.featureState = { ...(merged.featureState||{}), ...m.featureState };
      }
      return merged;
    };
    return { getFillColor:(d:any)=>pick(d.id)?.fillColor??[64,128,200,160], getLineColor:(d:any)=>pick(d.id)?.lineColor??[32,64,100,200], getLineWidth:(d:any)=>pick(d.id)?.lineWidth??1, getElevation:(d:any)=>pick(d.id)?.elevation??0 };
  },

  /**
   * MapLibre の feature-state をスタイル辞書にもとづいて一括更新します。
   * paint/line-paint の式側で ['feature-state','selected'] などを参照してください。
   */
  applyMapLibreFeatureState(datasetId: DatasetId, map:any, sourceId:string){
    const ch=getCh(datasetId);
    // Base booleans from current states
    const all = new Set<Id>();
    ch.features.hovered.forEach(id=>all.add(id));
    ch.features.selected.forEach(id=>all.add(id));
    ch.features.matched.forEach(id=>all.add(id));
    all.forEach((fid)=>{
      try {
        map.setFeatureState({ source: sourceId, id: fid }, {
          hovered: ch.features.hovered.has(fid),
          selected: ch.features.selected.has(fid),
          matched: ch.features.matched.has(fid),
        });
      } catch (error) {
        logCrossViewWarning(`Failed to set feature state for id ${String(fid)}`, error);
      }
    });
    // Additional explicit featureState via style assignments
    ch.registry.featureAssignments.forEach((ids,sid)=>{
      const fs=ch.registry.styles.get(sid)?.map?.featureState;
      if(!fs) return;
      ids.forEach(fid=>{
        try {
          map.setFeatureState({source:sourceId,id:fid}, fs);
        } catch (error) {
          logCrossViewWarning(`Failed to apply registry feature state for id ${String(fid)}`, error);
        }
      });
    });
  },

  /** フォーカスイベントを発火（Snackbar などで利用） */
  emitFocus(datasetId: DatasetId, payload: FocusEventPayload){ const ch=getCh(datasetId); ch.focus = payload; ch.focusListeners.forEach(f=>f(payload)); },
  emitBlur(datasetId: DatasetId){ const ch=getCh(datasetId); ch.focus = null; ch.focusListeners.forEach(f=>f(null)); },
};
