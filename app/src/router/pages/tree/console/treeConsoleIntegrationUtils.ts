import type { TreeNode } from '@hierarchidb/tree-api';

export const logIntegrationWarning = (message: string, error: unknown): void => {
  if (typeof console === 'undefined') return;
  console.warn('[TreeConsoleIntegration]', message, error);
};

export const isSubscriptionDebug = (): boolean => {
  try {
    return (
      (import.meta as ImportMeta & { env?: Record<string, string> }).env
        ?.VITE_SUBSCRIPTION_DEBUG === '1'
    );
  } catch (error) {
    logIntegrationWarning('Failed to read VITE_SUBSCRIPTION_DEBUG flag', error);
    return false;
  }
};

export function canImportFromNode(node?: TreeNode | null): boolean {
  if (!node?.nodeType) {
    return true;
  }
  return node.nodeType.toLowerCase() === 'folder';
}
