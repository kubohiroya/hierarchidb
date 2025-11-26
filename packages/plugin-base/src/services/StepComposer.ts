import { HostProfileRegistry } from '../registry/HostProfileRegistry.js';
import {
  type PluginStepConfig,
  type StepData,
  PluginStepRegistry,
} from '../registry/PluginStepRegistry.js';

export interface ComposeResult {
  configs: PluginStepConfig<StepData>[];
  hasHostBase: boolean;
  hostCanSubmit?: (data: StepData) => boolean | Promise<boolean>;
}

export function composeStepConfigs(
  nodeType: string,
  mode: 'create' | 'edit',
  existingData?: StepData
): ComposeResult {
  const hostReg = HostProfileRegistry.getInstance();
  const pluginReg = PluginStepRegistry.getInstance();

  const hostName = hostReg.resolveHostForNodeType(nodeType);
  const host = hostName ? hostReg.get(hostName) : undefined;

  const hostBase = host ? host.getBaseStepConfigs(mode, { nodeType }) : [];

  // Prefer config providers if available
  const cfgp = pluginReg.getConfigProvider(nodeType);
  const pluginCfgs = cfgp
    ? mode === 'create'
      ? cfgp.getCreateStepConfigs()
      : cfgp.getEditStepConfigs('', existingData)
    : [];

  // Deduplicate by step id with "extension/plugin overrides host" policy.
  // Preserve host-provided ordering for base steps, allowing plugin configs to override
  // matching ids. Any additional plugin-defined steps are appended in their declared order.
  const pluginById = new Map<string, PluginStepConfig<StepData>>(
    pluginCfgs.map((cfg) => [cfg.id, cfg])
  );
  const merged: PluginStepConfig<StepData>[] = [];
  const seen = new Set<string>();

  for (const baseCfg of hostBase) {
    const override = pluginById.get(baseCfg.id);
    if (override) {
      merged.push(override);
      seen.add(override.id);
    } else {
      merged.push(baseCfg);
      seen.add(baseCfg.id);
    }
  }

  for (const cfg of pluginCfgs) {
    if (seen.has(cfg.id)) continue;
    merged.push(cfg);
    seen.add(cfg.id);
  }

  const hasBasic = merged.some((c) => c.id === 'basic-info');
  return {
    configs: merged,
    // If basic step is provided either by host or plugin, suppress fallback basic in PluginDialog
    hasHostBase: hasBasic || (!!host && hostBase.length > 0),
    hostCanSubmit: host?.canSubmit,
  };
}
