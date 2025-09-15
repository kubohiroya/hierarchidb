import type { PluginDialogComponent, PluginPanelComponent } from '@hierarchidb/ui-core';

export async function getDialogComponent(): Promise<PluginDialogComponent> {
  const mod = await import('../components/LocationDialog');
  return (mod as any).LocationDialog as unknown as PluginDialogComponent;
}

export async function getPanelComponent(): Promise<PluginPanelComponent> {
  const mod = await import('../components/LocationPanel');
  return (mod as any).LocationPanel as unknown as PluginPanelComponent;
}

// Register host-composed steps on import (idempotent)
import './steps-provider';
