// @ts-ignore
import type { UIPluginDefinition } from '@hierarchidb/ui-core';
// @ts-ignore
import { registerStubUiPlugin } from './createStubUiPlugin.js';

type BaseMapEntity = {
  id?: string;
  name?: string;
};

type UseBaseMapEntityResult = {
  entity: BaseMapEntity | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
  updateEntity: () => Promise<void>;
};

const BaseMapPlaceholder: React.FC<{ title: string }> = ({ title }) => (
  <div
    data-stub="basemap"
style={{
  padding: 16,
    borderRadius: 12,
    border: '1px solid #b0bec5',
    background: '#eceff1',
    color: '#37474f',
}}
>
<h3 style={{ marginTop: 0 }}>{title}</h3>
<p style={{ marginBottom: 0 }}>Base map UI elements are unavailable in this preview environment.</p>
</div>
);

export const BaseMapDisplay: React.FC = () => <BaseMapPlaceholder title="Base Map Display" />;
export const BaseMapPanel: React.FC = () => <BaseMapPlaceholder title="Base Map Panel" />;
export const BaseMapPreview: React.FC = () => <BaseMapPlaceholder title="Base Map Preview" />;

export function useBaseMapEntity(): UseBaseMapEntityResult {
  return {
    entity: null,
    loading: false,
    error: new Error('BaseMap entity unavailable in stub environment'),
    refetch: () => {
      if (typeof console !== 'undefined') {
        console.warn('[basemap-stub] refetch invoked; no data available.');
      }
    },
    updateEntity: async () => {
      throw new Error('BaseMap updateEntity is unavailable in this environment.');
    },
  };
}

export function useBaseMapConfiguration() {
  return {
    config: null,
    loading: false,
    error: new Error('BaseMap configuration unavailable in stub environment'),
  } as const;
}

export function useBaseMapValidation() {
  return {
    isValid: false,
    errors: ['BaseMap validation is unavailable in this environment.'],
    validating: false,
  } as const;
}

const BaseMapIcon: React.FC = () => (
  <span data-stub="basemap-icon" role="img" aria-label="Base map">
    🗺️
  </span>
);

export const BaseMapUIPlugin: UIPluginDefinition = registerStubUiPlugin('basemap', {
  displayName: 'Base Map',
  group: 'advanced',
  requiresEntity: true,
  entityType: 'basemap',
  primaryColor: '#546e7a',
  icon: BaseMapIcon,
  components: {
    icon: BaseMapIcon,
    detailPanel: BaseMapPanel,
    preview: BaseMapPreview,
  },
});

export default BaseMapUIPlugin;

