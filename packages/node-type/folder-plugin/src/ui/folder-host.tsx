import { HostProfileRegistry, type StepComponentProps, type PluginStepConfig } from '@hierarchidb/runtime-ui-plugin-dialog';
import { BasicInfoStep } from '@hierarchidb/runtime-ui-plugin-dialog';
import type { TagId } from '@hierarchidb/common-type';

type FolderData = { name?: string; description?: string; tags?: TagId[] };

const registry = HostProfileRegistry.getInstance();

registry.register<FolderData>({
  name: 'folder',
  getBaseStepConfigs: (_mode, _ctx) => {
    // Use the new unified BasicInfoStep to avoid deprecated folder-specific screen
    const cfg: PluginStepConfig = {
      id: 'basic-info',
      label: 'Basic Information',
      componentFactory: (p: StepComponentProps) => {
        const data = (p.data as FolderData) || {};
        return (
          <BasicInfoStep
            name={data.name || ''}
            description={data.description || ''}
            tags={(data.tags as unknown as string[]) || []}
            mode={(p as any).mode || 'create'}
            onChange={(d) => p.onChange({ ...data, name: d.name, description: d.description, tags: d.tags as unknown as TagId[] })}
          />
        );
      },
      // Validation is handled by host canSubmit and per-step UI
    };
    return [cfg];
  },
  canSubmit: (data: FolderData) => Boolean(data?.name && data.name.trim().length > 0),
});
