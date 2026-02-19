import {
  getMuiIconWithColor,
  type IconDescriptorInput,
  IconRegistryProvider,
  type IconRegistryValue,
} from '@hierarchidb/ui-icon';
import type { SvgIconProps } from '@mui/material/SvgIcon';
import type { ComponentType, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { pluginIconLoaders } from '~/plugin-loaders/icon-loaders';
import { getInstalledPlugins } from '~/plugin-runtime/plugin-registry';
import { normalizeIconComponent } from '~/utils/normalizeIconComponent';

type IconDescriptor = {
  nodeType: string;
  component?: ComponentType<SvgIconProps> | null;
  color?: string;
  emoji?: string;
  muiIconName?: string;
};

const logIconWarning = (message: string, error?: unknown): void => {
  if (typeof console === 'undefined') return;
  if (error === undefined) {
    console.warn('[IconRegistryProvider]', message);
  } else {
    console.warn('[IconRegistryProvider]', message, error);
  }
};

async function buildIconDescriptorMap(): Promise<Record<string, IconDescriptor>> {
  const installed = getInstalledPlugins();
  const entries: Array<[string, IconDescriptor]> = [];

  await Promise.all(
    installed.map(async (plugin) => {
      const descriptor: IconDescriptor = {
        nodeType: plugin.nodeType,
        color: plugin.icon?.color,
        emoji: plugin.icon?.emoji,
        muiIconName: plugin.icon?.muiIconName,
      };

      const loader = pluginIconLoaders[plugin.nodeType];
      if (typeof loader === 'function') {
        try {
          const mod = await loader();
          descriptor.component = normalizeIconComponent(mod);
        } catch (error) {
          logIconWarning(`Failed to load icon component for ${plugin.nodeType}`, error);
        }
      }

      entries.push([plugin.nodeType, descriptor]);
    })
  );

  return Object.fromEntries(entries);
}

function renderWithDescriptor(
  descriptor: IconDescriptor | undefined,
  request: IconDescriptorInput
): ReactNode {
  if (descriptor?.component) {
    const IconComponent = descriptor.component;
    const color = descriptor.color ?? request.icon?.color;
    return <IconComponent sx={color ? { color } : undefined} />;
  }
  const fallback = request.icon;
  const muiIconName = descriptor?.muiIconName ?? fallback?.muiIconName ?? request.nodeType;
  const emoji = descriptor?.emoji ?? fallback?.emoji;
  const color = descriptor?.color ?? fallback?.color;
  return getMuiIconWithColor(muiIconName, emoji, color);
}

export function AppIconRegistryProvider({ children }: { children: ReactNode }) {
  const [registry, setRegistry] = useState<Record<string, IconDescriptor>>({});
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    const initialize = async () => {
      try {
        const map = await buildIconDescriptorMap();
        if (cancelled) return;
        setRegistry(map);
        setReady(true);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        const normalized = err instanceof Error ? err : new Error(String(err));
        setError(normalized);
        setReady(false);
      }
    };
    initialize();
    return () => {
      cancelled = true;
    };
  }, []);

  const resolveIcon = useCallback<IconRegistryValue['resolveIcon']>(
    (request) => renderWithDescriptor(registry[request.nodeType ?? ''], request),
    [registry]
  );

  const value = useMemo<IconRegistryValue>(
    () => ({
      resolveIcon,
      ready,
      error,
    }),
    [resolveIcon, ready, error]
  );

  return <IconRegistryProvider value={value}>{children}</IconRegistryProvider>;
}
