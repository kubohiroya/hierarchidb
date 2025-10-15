import type { NodeId } from '@hierarchidb/common-types';

type WorkingCopy = {
  id: NodeId;
  nodeType: string;
  parentNodeId?: NodeId;
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

type Capabilities = {
  canNavigateTo: boolean;
  canStartBatch: boolean;
  canSave: boolean;
  canProceedToNext: boolean;
  canBackToPrevious: boolean;
};

export type MultiStepDialogAPI = {
  createWorkingCopy(nodeType: string, parentNodeId?: NodeId): Promise<NodeId>;
  getWorkingCopy(workingCopyId: NodeId): Promise<WorkingCopy | undefined>;
  updateWorkingCopy(workingCopyId: NodeId, updates: Partial<WorkingCopy>): Promise<WorkingCopy>;
  deleteWorkingCopy(workingCopyId: NodeId): Promise<void>;
  evaluateCapabilities(workingCopyId: NodeId, step: number): Promise<Capabilities>;
  batchValidate(ids: NodeId[]): Promise<Record<string, { valid: boolean; errors?: string[]; warnings?: string[] }>>;
  batchEvaluateCapabilities(
    inputs: { workingCopyId: NodeId; step: number }[],
  ): Promise<Record<string, Capabilities>>;
};

function genId(prefix: string = 'wc'): NodeId {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}` as NodeId;
}

export class WorkerAPIImpl {
  private store = new Map<NodeId, WorkingCopy>();

  constructor(private _ns: string) {}

  async initialize(): Promise<void> {
    // no-op for mock
  }

  async shutdown(): Promise<void> {
    this.store.clear();
  }

  getMultiStepDialogAPI(): MultiStepDialogAPI {
    const self = this;

    async function get(id: NodeId) {
      const wc = self.store.get(id);
      if (!wc) throw new Error('Working copy not found');
      return wc;
    }

    return {
      async createWorkingCopy(nodeType: string, parentNodeId?: NodeId): Promise<NodeId> {
        if (!['folder-plugin', 'folder', 'location', 'location-plugin', 'basemap', 'spreadsheet', 'shape', 'styler', 'route', 'resolver', 'project'].includes(nodeType)) {
          throw new Error(`No handler found for node type: ${nodeType}`);
        }
        const id = genId();
        const wc: WorkingCopy = {
          id,
          nodeType,
          parentNodeId,
          data: {},
          metadata: { currentStep: 0 },
        };
        self.store.set(id, wc);
        return id;
      },

      async getWorkingCopy(workingCopyId: NodeId): Promise<WorkingCopy | undefined> {
        return self.store.get(workingCopyId);
      },

      async updateWorkingCopy(workingCopyId: NodeId, updates: Partial<WorkingCopy>): Promise<WorkingCopy> {
        const wc = await get(workingCopyId);
        const mergedData = updates.data ? { ...wc.data, ...updates.data } : wc.data;
        const mergedMeta = updates.metadata ? { ...wc.metadata, ...updates.metadata } : wc.metadata;
        const next: WorkingCopy = {
          ...wc,
          ...updates,
          data: mergedData,
          metadata: mergedMeta,
        };
        self.store.set(workingCopyId, next);
        return next;
      },

      async deleteWorkingCopy(workingCopyId: NodeId): Promise<void> {
        self.store.delete(workingCopyId);
      },

      async evaluateCapabilities(workingCopyId: NodeId, step: number): Promise<Capabilities> {
        const wc = await get(workingCopyId);
        const d = wc.data || {};
        const isFolder = wc.nodeType === 'folder-plugin' || wc.nodeType === 'folder';
        const isLocation = wc.nodeType === 'location' || wc.nodeType === 'location-plugin';
        const isBaseMap = wc.nodeType === 'basemap';
        const isSpreadsheet = wc.nodeType === 'spreadsheet';
        const isShape = wc.nodeType === 'shape';
        const isStyler = wc.nodeType === 'styler';
        const isRoute = wc.nodeType === 'route';
        const isResolver = wc.nodeType === 'resolver';
        const isProject = wc.nodeType === 'project';

        const base: Capabilities = {
          canNavigateTo: false,
          canStartBatch: false,
          canSave: false,
          canProceedToNext: false,
          canBackToPrevious: step > 0,
        };

        if (isFolder) {
          if (step === 0) {
            base.canNavigateTo = true;
            base.canProceedToNext = Boolean(d.name);
          } else if (step === 1) {
            const ok = Boolean(d.name);
            base.canNavigateTo = ok;
            base.canStartBatch = ok;
            base.canSave = ok;
            base.canProceedToNext = ok;
            base.canBackToPrevious = true;
          } else if (step === 2) {
            base.canNavigateTo = Boolean(d.name);
            base.canStartBatch = Boolean(d.name);
            base.canSave = Boolean(d.name);
            base.canProceedToNext = false;
            base.canBackToPrevious = true;
          }
        }

        if (isLocation) {
          if (step === 0) {
            base.canProceedToNext = Boolean(d.name && d.locationType);
          } else if (step === 1) {
            const coordsOk = typeof d.latitude === 'number' && typeof d.longitude === 'number'
              && d.latitude >= -90 && d.latitude <= 90 && d.longitude >= -180 && d.longitude <= 180;
            base.canProceedToNext = coordsOk;
            base.canSave = coordsOk;
            base.canStartBatch = coordsOk;
          } else if (step === 2) {
            base.canNavigateTo = true;
            base.canSave = true;
            base.canStartBatch = true;
          }
        }

        if (isBaseMap) {
          // Step 0: Basic info (inherited from folder) – require name
          if (step === 0) {
            base.canNavigateTo = true;
            base.canProceedToNext = Boolean(d.name?.trim());
            return base;
          }
          // Step 1: Map Style – require mapStyle.style; if 'custom', require customStyleUrl
          if (step === 1) {
            const ok = Boolean(d.name?.trim());
            const styleOk = Boolean(d.mapStyle?.style) && (d.mapStyle?.style !== 'custom' || Boolean(d.mapStyle?.customStyleUrl));
            base.canNavigateTo = ok;
            base.canProceedToNext = ok && styleOk;
            base.canSave = ok && styleOk;
            base.canBackToPrevious = true;
            return base;
          }
          // Step 2: Viewport – require viewport.center [lng,lat] and zoom 0..24
          if (step === 2) {
            const ok = Boolean(d.name?.trim());
            const vp = d.viewport;
            const vpOk = !!vp && Array.isArray(vp.center) && typeof vp.center[0] === 'number' && typeof vp.center[1] === 'number' && typeof vp.zoom === 'number' && vp.zoom >= 0 && vp.zoom <= 24;
            base.canNavigateTo = ok;
            base.canProceedToNext = ok && vpOk;
            base.canSave = ok && vpOk;
            base.canBackToPrevious = true;
            return base;
          }
          // Step 3: Display Options – optional
          if (step === 3) {
            const ok = Boolean(d.name?.trim());
            base.canNavigateTo = ok;
            base.canProceedToNext = true;
            base.canSave = ok;
            base.canBackToPrevious = true;
            return base;
          }
        }

        if (isSpreadsheet) {
          if (step === 0) {
            base.canNavigateTo = true;
            base.canProceedToNext = Boolean(d.name?.trim());
            return base;
          }
          if (step === 1) {
            const ok = Boolean(d.name?.trim());
            const dsOk = !!d.dataSource && ['file', 'url', 'manual'].includes(d.dataSource?.type);
            base.canNavigateTo = ok;
            base.canProceedToNext = ok && dsOk;
            base.canSave = ok && dsOk;
            base.canBackToPrevious = true;
            return base;
          }
          if (step === 2) {
            base.canNavigateTo = true;
            base.canProceedToNext = true;
            base.canSave = true;
            base.canBackToPrevious = true;
            return base;
          }
        }

        if (isShape) {
          if (step === 0) {
            base.canNavigateTo = true;
            base.canProceedToNext = Boolean(d.name?.trim());
            return base;
          }
          if (step === 1) {
            const ok = Boolean(d.name?.trim());
            const srcOk = Boolean(d.dataSourceName);
            base.canNavigateTo = ok;
            base.canProceedToNext = ok && srcOk;
            base.canSave = ok && srcOk;
            base.canBackToPrevious = true;
            return base;
          }
          if (step === 2) {
            const licOk = d.licenseAgreement === true;
            base.canNavigateTo = true;
            base.canProceedToNext = licOk;
            base.canSave = licOk;
            base.canBackToPrevious = true;
            return base;
          }
          if (step === 3) {
            const levels: number[] = d.selectedAdminLevels || [];
            const ok = Array.isArray(levels) && levels.length > 0 && levels.every((x) => typeof x === 'number' && x >= 0 && x <= 3);
            base.canNavigateTo = true;
            base.canProceedToNext = ok;
            base.canSave = ok;
            base.canBackToPrevious = true;
            return base;
          }
          if (step === 4) {
            const countries: string[] = d.selectedCountries || [];
            const ok = Array.isArray(countries) && countries.length > 0;
            base.canNavigateTo = true;
            base.canProceedToNext = ok;
            base.canSave = ok;
            base.canBackToPrevious = true;
            return base;
          }
        }

        if (isStyler) {
          if (step === 0) {
            base.canNavigateTo = true;
            base.canProceedToNext = Boolean(d.name?.trim());
            return base;
          }
          if (step === 1) {
            const styleOk = !d.styleType || !!d.dataSource; // styleType選択時はdataSource必須
            base.canNavigateTo = true;
            base.canProceedToNext = styleOk;
            base.canSave = styleOk;
            base.canBackToPrevious = true;
            return base;
          }
          if (step === 2) {
            const cats: string[] = d.categories || [];
            const unique = new Set(cats);
            const ok = cats.length <= 50 && unique.size === cats.length;
            base.canNavigateTo = true;
            base.canProceedToNext = ok;
            base.canSave = ok;
            base.canBackToPrevious = true;
            return base;
          }
        }

        if (isRoute) {
          if (step === 0) {
            const ok = Boolean(d.name?.trim()) && Boolean(d.routeType) && Array.isArray(d.transportModes) && d.transportModes.length > 0;
            base.canNavigateTo = true;
            base.canProceedToNext = ok;
            return base;
          }
          if (step === 1) {
            base.canNavigateTo = true;
            base.canProceedToNext = true; // selection simplified
            base.canSave = true;
            base.canBackToPrevious = true;
            return base;
          }
          if (step === 2) {
            base.canNavigateTo = true;
            base.canProceedToNext = true;
            base.canSave = true;
            base.canBackToPrevious = true;
            return base;
          }
        }

        if (isResolver) {
          if (step === 0) {
            base.canNavigateTo = true;
            base.canProceedToNext = Boolean(d.name?.trim());
            return base;
          }
          if (step === 1) {
            const ok = Boolean(d.sourceSchema) && Boolean(d.targetSchema);
            base.canNavigateTo = true;
            base.canProceedToNext = ok;
            base.canSave = ok;
            base.canBackToPrevious = true;
            return base;
          }
          if (step === 2) {
            base.canNavigateTo = true;
            base.canProceedToNext = Array.isArray(d.mappingRules);
            base.canSave = Array.isArray(d.mappingRules);
            base.canBackToPrevious = true;
            return base;
          }
          if (step === 3) {
            base.canNavigateTo = true;
            base.canProceedToNext = true;
            base.canSave = true;
            base.canBackToPrevious = true;
            return base;
          }
          if (step === 4) {
            base.canNavigateTo = true;
            base.canProceedToNext = Boolean(d.duplicateResolution);
            base.canSave = Boolean(d.duplicateResolution);
            base.canBackToPrevious = true;
            return base;
          }
          if (step === 5) {
            base.canNavigateTo = true;
            base.canProceedToNext = true;
            base.canSave = true;
            base.canBackToPrevious = true;
            return base;
          }
        }

        if (isProject) {
          base.canNavigateTo = true;
          base.canProceedToNext = true;
          base.canSave = true;
          base.canBackToPrevious = step > 0;
          return base;
        }

        return base;
      },

      async batchValidate(ids: NodeId[]) {
        const out: Record<string, { valid: boolean; errors?: string[]; warnings?: string[] }> = {};
        for (const id of ids) {
          const wc = await get(id);
          const d = wc.data || {};
          if (wc.nodeType === 'folder-plugin' || wc.nodeType === 'folder') {
            const errors: string[] = [];
            if (!d.name) errors.push('フォルダー名は必須です');
            if (d?.permissions === 'invalid') errors.push('権限設定の形式が正しくありません');
            out[id] = { valid: errors.length === 0, errors: errors.length ? errors : undefined };
          } else if (wc.nodeType === 'location' || wc.nodeType === 'location-plugin') {
            const errors: string[] = [];
            const warnings: string[] = [];
            if (!d.name) errors.push('ロケーション名は必須です');
            if (typeof d.latitude === 'number' && (d.latitude < -90 || d.latitude > 90)) {
              errors.push('緯度は-90から90の数値である必要があります');
            }
            if (typeof d.longitude === 'number' && (d.longitude < -180 || d.longitude > 180)) {
              errors.push('経度は-180から180の数値である必要があります');
            }
            const email = d?.contact?.email as string | undefined;
            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
              warnings.push('メールアドレスの形式が正しくない可能性があります');
            }
            out[id] = {
              valid: errors.length === 0,
              errors: errors.length ? errors : undefined,
              warnings: warnings.length ? warnings : undefined,
            };
          } else {
            out[id] = { valid: true };
          }
        }
        return out;
      },

      async batchEvaluateCapabilities(inputs: { workingCopyId: NodeId; step: number }[]) {
        const out: Record<string, Capabilities> = {};
        for (const item of inputs) {
          out[item.workingCopyId] = await this.evaluateCapabilities(item.workingCopyId, item.step);
        }
        return out;
      },
    };
  }
}
