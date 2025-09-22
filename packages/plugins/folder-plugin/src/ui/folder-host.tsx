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
  componentFactory: (props: StepComponentProps) => {
    const data = (props.data as FolderData) ?? {};
    const mode = (props as StepComponentProps & { mode?: 'create' | 'edit' }).mode ?? 'create';
    const tagStrings = Array.isArray(data.tags)
      ? data.tags.map((tag) => String(tag))
      : [];

    return (
      <BasicInfoStep
        name={data.name ?? ''}
        description={data.description ?? ''}
        tags={tagStrings}
        mode={mode}
        onChange={(next) =>
          props.onChange({
            ...data,
            name: next.name,
            description: next.description,
            tags: next.tags?.map((tag) => tag as unknown as TagId),
          })
        }
      />
    );
  },
  // Validation is handled by host canSubmit and per-step UI
};
    return [cfg];
  },
  canSubmit: (data: FolderData) => Boolean(data?.name && data.name.trim().length > 0),
});
