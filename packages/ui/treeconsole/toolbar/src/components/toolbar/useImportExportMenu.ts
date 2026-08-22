import { type FocusEvent, type MouseEvent, useCallback, useEffect, useMemo, useState } from 'react';

interface UseImportExportMenuParams {
  allowImport: boolean;
  templates: Array<{ id: string; label?: string }>;
}

export function useImportExportMenu({ allowImport, templates }: UseImportExportMenuParams) {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [templateAnchor, setTemplateAnchor] = useState<HTMLElement | null>(null);

  const openMenu = useCallback((event: MouseEvent<HTMLElement>) => {
    setMenuAnchor(event.currentTarget);
  }, []);

  const closeTemplateMenu = useCallback(() => {
    setTemplateAnchor(null);
  }, []);

  const closeMenu = useCallback(() => {
    setMenuAnchor(null);
    setTemplateAnchor(null);
  }, []);

  const openTemplateMenuFromMouse = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (!allowImport) return;
      event.preventDefault();
      event.stopPropagation();
      setTemplateAnchor(event.currentTarget);
    },
    [allowImport]
  );

  const openTemplateMenuFromFocus = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      if (!allowImport) return;
      event.preventDefault();
      event.stopPropagation();
      setTemplateAnchor(event.currentTarget as HTMLElement);
    },
    [allowImport]
  );

  const hasTemplates = useMemo(
    () => allowImport && templates.length > 0,
    [allowImport, templates.length]
  );

  useEffect(() => {
    if (!allowImport) {
      setTemplateAnchor(null);
    }
  }, [allowImport]);

  return {
    menuAnchor,
    templateAnchor,
    hasTemplates,
    openMenu,
    closeMenu,
    openTemplateMenuFromMouse,
    openTemplateMenuFromFocus,
    closeTemplateMenu,
  };
}
