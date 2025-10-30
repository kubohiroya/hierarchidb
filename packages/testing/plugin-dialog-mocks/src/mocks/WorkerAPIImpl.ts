import type { MultiStepDialogAPI, StepCapabilities, WorkingCopyData } from '@hierarchidb/common-api';
import type { NodeId, ValidationResult } from '@hierarchidb/common-types';

function genId(prefix: string = 'wc'): NodeId {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}` as NodeId;
}

export class WorkerAPIImpl {
  private store = new Map<NodeId, WorkingCopyData>();

  constructor(private readonly namespace: string) {}

  async initialize(): Promise<void> {
    // no-op for mock environment
  }

  async shutdown(): Promise<void> {
    this.store.clear();
  }

  getMultiStepDialogAPI(): MultiStepDialogAPI {
    const self = this;

    async function requireWorkingCopy(id: NodeId): Promise<WorkingCopyData> {
      const wc = self.store.get(id);
      if (!wc) throw new Error('Working copy not found');
      return wc;
    }

    return {
      async createWorkingCopy(nodeType: string, parentNodeId?: NodeId): Promise<NodeId> {
        const normalized = nodeType.toLowerCase();
        const supported = new Set([
          'folder-plugin',
          'folder',
          'location',
          'location-plugin',
          'basemap',
          'spreadsheet',
          'shape',
          'styler',
          'route',
          'resolver',
          'project',
        ]);
        if (!supported.has(normalized)) {
          throw new Error(`No handler found for node type: ${nodeType}`);
        }
        const id = genId();
        const now = new Date();
        const wc: WorkingCopyData = {
          id,
          nodeType,
          parentNodeId,
          data: {},
          metadata: {
            createdAt: now,
            updatedAt: now,
            currentStep: 0,
            validationState: {},
          },
        };
        self.store.set(id, wc);
        return id;
      },

      async getWorkingCopy(workingCopyId: NodeId): Promise<WorkingCopyData | undefined> {
        return self.store.get(workingCopyId);
      },

      async updateWorkingCopy(workingCopyId: NodeId, updates: Partial<WorkingCopyData>): Promise<WorkingCopyData> {
        const wc = await requireWorkingCopy(workingCopyId);
        const metadata = updates.metadata ? { ...wc.metadata, ...updates.metadata } : { ...wc.metadata };
        metadata.updatedAt = new Date();
        const next: WorkingCopyData = {
          ...wc,
          ...updates,
          data: updates.data ? { ...wc.data, ...updates.data } : wc.data,
          metadata,
        };
        self.store.set(workingCopyId, next);
        return next;
      },

      async deleteWorkingCopy(workingCopyId: NodeId): Promise<void> {
        self.store.delete(workingCopyId);
      },

      async evaluateCapabilities(workingCopyId: NodeId, step: number): Promise<StepCapabilities> {
        const wc = await requireWorkingCopy(workingCopyId);
        const data = wc.data ?? {};
        const nodeType = wc.nodeType;

        if (nodeType === 'project') {
          return {
            canNavigateTo: true,
            canStartBatch: true,
            canSave: true,
            canProceedToNext: true,
            canBackToPrevious: step > 0,
          };
        }

        const result: StepCapabilities = {
          canNavigateTo: false,
          canStartBatch: false,
          canSave: false,
          canProceedToNext: false,
          canBackToPrevious: step > 0,
        };

        const namePresent = Boolean((data as { name?: unknown }).name);

        if (nodeType === 'folder' || nodeType === 'folder-plugin') {
          if (step === 0) {
            result.canNavigateTo = true;
            result.canProceedToNext = namePresent;
          } else {
            result.canNavigateTo = namePresent;
            result.canStartBatch = namePresent;
            result.canSave = namePresent;
            result.canProceedToNext = step === 1 ? namePresent : false;
            result.canBackToPrevious = true;
          }
          return result;
        }

        if (nodeType.startsWith('location')) {
          if (step === 0) {
            result.canProceedToNext = Boolean((data as any).locationType && namePresent);
          } else if (step === 1) {
            const { latitude, longitude } = data as any;
            const coordsOk = typeof latitude === 'number'
              && typeof longitude === 'number'
              && latitude >= -90 && latitude <= 90
              && longitude >= -180 && longitude <= 180;
            result.canProceedToNext = coordsOk;
            result.canSave = coordsOk;
            result.canStartBatch = coordsOk;
          } else {
            result.canNavigateTo = true;
            result.canSave = true;
            result.canStartBatch = true;
          }
          return result;
        }

        if (nodeType === 'basemap') {
          if (step === 0) {
            result.canNavigateTo = true;
            result.canProceedToNext = namePresent;
            return result;
          }
          if (step === 1) {
            const style = (data as any).mapStyle;
            const styleOk = !!style?.style && (style.style !== 'custom' || Boolean(style?.customStyleUrl));
            result.canNavigateTo = true;
            result.canProceedToNext = namePresent && styleOk;
            result.canSave = namePresent && styleOk;
            result.canBackToPrevious = true;
            return result;
          }
          if (step === 2) {
            const viewport = (data as any).viewport;
            const coordsOk = Array.isArray(viewport?.center)
              && typeof viewport.center[0] === 'number'
              && typeof viewport.center[1] === 'number';
            const zoomOk = typeof viewport?.zoom === 'number' && viewport.zoom >= 0 && viewport.zoom <= 24;
            result.canNavigateTo = true;
            result.canProceedToNext = namePresent && coordsOk && zoomOk;
            result.canSave = namePresent && coordsOk && zoomOk;
            result.canBackToPrevious = true;
            return result;
          }
          result.canNavigateTo = true;
          result.canSave = namePresent;
          result.canProceedToNext = true;
          result.canBackToPrevious = true;
          return result;
        }

        result.canNavigateTo = namePresent;
        result.canSave = namePresent;
        result.canProceedToNext = namePresent;
        return result;
      },

      async batchValidate(ids: NodeId[]): Promise<Record<NodeId, ValidationResult>> {
        const out = Object.create(null) as Record<NodeId, ValidationResult>;
        for (const id of ids) {
          const validation: ValidationResult = { valid: true, errors: [], warnings: [] } as ValidationResult;
          try {
            const wc = await requireWorkingCopy(id);
            const nodeType = wc.nodeType;
            const data = (wc.data ?? {}) as Record<string, any>;

            const pushError = (message: string) => {
              validation.valid = false;
              (validation.errors ??= []).push(message);
            };
            const pushWarning = (message: string) => {
              (validation.warnings ??= []).push(message);
            };

            if (nodeType === 'folder' || nodeType === 'folder-plugin') {
              if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
                pushError('フォルダー名は必須です');
              }
              if (data.permissions && !['read-only', 'read-write'].includes(data.permissions)) {
                pushError('権限設定の形式が正しくありません');
              }
            } else if (nodeType === 'location' || nodeType === 'location-plugin') {
              if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
                pushError('ロケーション名は必須です');
              }
              const latitude = Number(data.latitude);
              if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
                pushError('緯度は-90から90の数値である必要があります');
              }
              const longitude = Number(data.longitude);
              if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
                pushError('経度は-180から180の数値である必要があります');
              }
              const email = typeof data?.contact?.email === 'string' ? data.contact.email.trim() : '';
              if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                pushWarning('メールアドレスの形式が正しくない可能性があります');
              }
            }
          } catch (error) {
            (validation.errors ??= []).push(error instanceof Error ? error.message : String(error));
            validation.valid = false;
          }
          out[id] = validation;
        }
        return out;
      },

      async batchEvaluateCapabilities(requests: Array<{ workingCopyId: NodeId; step: number }>) {
        const out = Object.create(null) as Record<NodeId, StepCapabilities>;
        for (const { workingCopyId, step } of requests) {
          out[workingCopyId] = await this.evaluateCapabilities(workingCopyId, step);
        }
        return out;
      },

      async saveWorkingCopy(workingCopyId: NodeId): Promise<NodeId> {
        await requireWorkingCopy(workingCopyId);
        return workingCopyId;
      },
    } satisfies MultiStepDialogAPI;
  }
}
