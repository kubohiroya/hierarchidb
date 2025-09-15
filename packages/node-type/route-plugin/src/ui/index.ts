// Standardized UI-side exports (polymorphic contract)
import type { PluginDialogComponent, PluginPanelComponent } from '@hierarchidb/ui-core';

export async function getDialogComponent(): Promise<PluginDialogComponent> {
  const mod = await import('../components/RouteDialog');
  return (mod as any).RouteDialog as unknown as PluginDialogComponent;
}

export async function getPanelComponent(): Promise<PluginPanelComponent> {
  const mod = await import('../components/RoutePanel');
  return (mod as any).RoutePanel as unknown as PluginPanelComponent;
}

// Register host-composed steps on import (idempotent in registry)
import './steps-provider';
