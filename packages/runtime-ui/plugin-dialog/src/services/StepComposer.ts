import { HostProfileRegistry } from '../registry/HostProfileRegistry.js';
import { PluginStepRegistry, type PluginStepConfig } from '../registry/PluginStepRegistry.js';

export interface ComposeResult {
  configs: PluginStepConfig[];
  hasHostBase: boolean;
  hostCanSubmit?: (data: unknown) => boolean | Promise<boolean>;
}

export function composeStepConfigs(nodeType: string, mode: 'create' | 'edit'): ComposeResult {
  const hostReg = HostProfileRegistry.getInstance();
  const pluginReg = PluginStepRegistry.getInstance();

  const hostName = hostReg.resolveHostForNodeType(nodeType);
  const host = hostName ? hostReg.get(hostName) : undefined;

  const hostBase = host ? host.getBaseStepConfigs(mode, { nodeType }) : [];

  // Prefer config providers if available
  const cfgp = pluginReg.getConfigProvider(nodeType);
  const pluginCfgs = cfgp
    ? (mode === 'create' ? cfgp.getCreateStepConfigs() : cfgp.getEditStepConfigs(''))
    : [];

  // Deduplicate by step id with "extension/plugin overrides host" policy.
  // Preserve plugin-defined order first, then append any host steps not provided by plugin.
  const pluginIds = new Set<string>(pluginCfgs.map((c) => c.id));
  const merged: PluginStepConfig[] = [
    ...pluginCfgs,
    ...hostBase.filter((h) => !pluginIds.has(h.id)),
  ];

  const hasBasic = merged.some((c) => c.id === 'basic-info');
  return {
    configs: merged,
    // If basic step is provided either by host or plugin, suppress fallback basic in PluginDialog
    hasHostBase: hasBasic || (!!host && hostBase.length > 0),
    hostCanSubmit: host?.canSubmit,
  };
}
