import { BasicInfoStep } from '@hierarchidb/plugin-ui-host';
import { HostProfileRegistry, type PluginStepConfig, type StepComponentProps } from '@hierarchidb/plugin-base';
import type { TagId } from '@hierarchidb/common-types';

type FolderData = { name?: string; description?: string; tags?: TagId[] };

const registry = HostProfileRegistry.getInstance();

registry.register<FolderData>({
  name: 'folder',
  getBaseStepConfigs: (_mode, _ctx) => {
    const config: PluginStepConfig = {
      id: 'basic-info',
      label: 'Basic Information',
      componentFactory: (props: StepComponentProps) => {
        const data = (props.data as FolderData) ?? {};
        const mode = (props as StepComponentProps & { mode?: 'create' | 'edit' }).mode ?? 'create';
        const tagStrings = Array.isArray(data.tags) ? data.tags.map((tag) => String(tag)) : [];
        const meta = (data as { __basicInfoValidation?: { error?: string | null } })
          ?.__basicInfoValidation;
        const validationMessage =
          typeof meta?.error === 'string' && meta.error.trim().length > 0 ? meta.error : null;

        return (
          <BasicInfoStep
            name={data.name ?? ''}
            description={data.description ?? ''}
            tags={tagStrings}
            mode={mode}
            validate={
              validationMessage ? () => validationMessage : undefined
            }
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
    };

    return [config];
  },
  canSubmit: (data: FolderData) => Boolean(data?.name && data.name.trim().length > 0),
});
