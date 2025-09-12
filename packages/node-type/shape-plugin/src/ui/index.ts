import type { PluginDialogComponent, PluginPanelComponent } from '@hierarchidb/ui-core';

export async function getDialogComponent(): Promise<PluginDialogComponent> {
  const mod = await import('../components/ShapeDialog');
  return (mod as any).ShapeDialog as unknown as PluginDialogComponent;
}

export async function getPanelComponent(): Promise<PluginPanelComponent> {
  const mod = await import('../components/ShapeViewPanel');
  return (mod as any).ShapeViewPanel as unknown as PluginPanelComponent;
}
