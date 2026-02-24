import { useMemo } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { useTranslation } from '@hierarchidb/ui-i18n';
import { resolveStepTitleFromRegistry } from '@hierarchidb/plugin-registry/derivations';
import type { StepTitleTranslator } from '@hierarchidb/plugin-registry/derivations';
import { pluginRegistry } from '~/plugin-loaders/index';
import { resolveTreePageTitle, useAppDocumentTitle } from '~/router/title/pageTitle';

export function useTreeConsoleDocumentTitle() {
  const matches = useRouterState({ select: (state) => state.matches });
  const { i18n } = useTranslation();
  const translateStepTitle = useMemo<StepTitleTranslator>(
    () => (namespace, key) => {
      if (!i18n.exists(key, { ns: namespace })) {
        return '';
      }
      const translated = String(i18n.t(key, { ns: namespace }));
      return translated === key ? '' : translated;
    },
    [i18n]
  );
  const resolveStepTitle = useMemo(
    () => (nodeType: string, step: number) =>
      resolveStepTitleFromRegistry(pluginRegistry, nodeType, step, translateStepTitle),
    [translateStepTitle]
  );
  const nextTitle = useMemo(
    () => resolveTreePageTitle(matches, { resolveStepTitle }),
    [matches, resolveStepTitle]
  );
  useAppDocumentTitle(nextTitle);
}
