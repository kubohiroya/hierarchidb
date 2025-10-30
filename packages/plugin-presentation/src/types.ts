export interface PluginPresentationIconConfig {
  muiIconName?: string;
  emoji?: string;
  color?: string;
}

export interface PluginPresentationManifestIcon {
  mui?: string;
  muiIconName?: string;
  component?: {
    specifier?: string | null;
  } | null;
  emoji?: string;
  color?: string;
}

export interface PluginPresentationManifest {
  displayName?: string;
  name?: string;
  description?: string;
  priority?: number;
  icon?: PluginPresentationManifestIcon;
}

export interface PluginPresentationDefinition {
  nodeType: string;
  label?: string;
  icon?: PluginPresentationIconConfig | null;
  manifest?: PluginPresentationManifest | null;
  createOrder?: number;
}

export interface PluginPresentation {
  nodeType: string;
  label: string;
  icon: PluginPresentationIconConfig;
  priority: number;
}
