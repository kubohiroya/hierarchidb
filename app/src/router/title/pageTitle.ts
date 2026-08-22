import type { TreeNode } from '@hierarchidb/tree-api';
import { useEffect, useMemo } from 'react';
import { loadAppConfig } from '~/loadAppConfig';
import type {
  LoadNodeActionReturn,
  LoadPageNodeReturn,
  LoadTargetNodeReturn,
} from '~/router/loaders/treeLoaders';
import { treeRouteIds } from '~/router/routes/tree/treeRouteIds';

export type AppTitleOptions = {
  appNameOnly?: boolean;
};

export type StepTitleResolver = (nodeType: string, step: number) => string | null;

type RouterMatchLike = {
  routeId: string;
  loaderData?: unknown;
  params?: Record<string, string | undefined>;
};

type TreeDialogMatchData = {
  kind?: 'archive' | 'plugin';
  data?: unknown;
  params?: { action?: string; nodeType?: string; step?: string };
};

const safeTrim = (value?: string | null): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const getAppName = (): string => {
  return loadAppConfig().appName;
};

export const formatAppTitle = (
  pageTitle: string | null | undefined,
  appName: string,
  options: AppTitleOptions = {}
): string => {
  const normalizedAppName = safeTrim(appName) ?? '';
  if (options.appNameOnly || !pageTitle) {
    return normalizedAppName || pageTitle || '';
  }
  if (!normalizedAppName) {
    return pageTitle;
  }
  return `${pageTitle} - ${normalizedAppName}`;
};

export const resolveNodeDisplayName = (node?: TreeNode | null): string | null => {
  if (!node) return null;
  const draftName = safeTrim(
    (node as { draftMetadata?: { name?: string } | null }).draftMetadata?.name
  );
  if (draftName) return draftName;
  const metadataName = safeTrim(node.metadata?.name);
  return metadataName;
};

const decodeTagName = (raw?: string): string | null => {
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

const parseStepNumber = (value?: string): number | null => {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return parsed;
};

export const resolveTreePageTitle = (
  matches: RouterMatchLike[],
  options: { resolveStepTitle?: StepTitleResolver } = {}
): string | null => {
  const pageMatch = matches.find((match) => match.routeId === treeRouteIds.page);
  const targetMatch = matches.find((match) => match.routeId === treeRouteIds.target);
  const tagMatch = matches.find((match) => match.routeId === treeRouteIds.tags);
  const tagDetailMatch = matches.find((match) => match.routeId === treeRouteIds.tagName);
  const dialogRouteIds = new Set<string>([
    treeRouteIds.dialog,
    treeRouteIds.dialogMode,
    treeRouteIds.dialogModeStep,
  ]);
  const dialogMatch = matches.find((match) => dialogRouteIds.has(match.routeId));

  if (tagDetailMatch) {
    const tagName = decodeTagName(tagDetailMatch.params?.tag);
    return tagName ?? 'tags';
  }

  if (tagMatch) {
    return 'tags';
  }

  if (dialogMatch) {
    const dialogData = dialogMatch.loaderData as TreeDialogMatchData | undefined;
    if (dialogData?.kind === 'plugin') {
      const { targetNode, nodeType, params } = dialogData.data as LoadNodeActionReturn & {
        params?: { action?: string; nodeType?: string; step?: string };
      };
      const dialogTargetName = resolveNodeDisplayName(targetNode);
      if (dialogTargetName) {
        if (dialogMatch.routeId === treeRouteIds.dialogModeStep) {
          const stepValue = params?.step ?? dialogMatch.params?.step;
          const stepNumber = parseStepNumber(stepValue);
          const resolvedNodeType = nodeType ?? params?.nodeType ?? dialogData.params?.nodeType;
          const stepTitle =
            resolvedNodeType && stepNumber && options.resolveStepTitle
              ? options.resolveStepTitle(resolvedNodeType, stepNumber)
              : null;
          return stepTitle ? `${stepTitle}: ${dialogTargetName}` : dialogTargetName;
        }
        return dialogTargetName;
      }
    }
  }

  const targetData = targetMatch?.loaderData as LoadTargetNodeReturn | undefined;
  const targetTitle = resolveNodeDisplayName(targetData?.targetNode);
  if (targetTitle) {
    return targetTitle;
  }

  const pageData = pageMatch?.loaderData as LoadPageNodeReturn | undefined;
  const pageTitle = resolveNodeDisplayName(pageData?.pageNode) ?? safeTrim(pageData?.tree?.name);
  if (pageTitle) {
    return pageTitle;
  }

  return null;
};

export const useAppDocumentTitle = (
  pageTitle: string | null | undefined,
  options: AppTitleOptions = {}
): string => {
  const appName = useMemo(() => getAppName(), []);
  const resolvedTitle = useMemo(
    () => formatAppTitle(pageTitle, appName, options),
    [pageTitle, appName, options.appNameOnly]
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!resolvedTitle) return;
    document.title = resolvedTitle;
  }, [resolvedTitle]);

  return resolvedTitle;
};
