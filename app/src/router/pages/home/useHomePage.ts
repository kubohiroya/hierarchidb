import { useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppConfig } from '~/contexts/AppConfigContext';

export function useHomePage() {
  const navigate = useNavigate();
  const { appTitle, appDescription, appHomepage } = useAppConfig();
  const [isUserMenuReady, setUserMenuReady] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);

  useEffect(() => {
    setUserMenuReady(true);
    setIsClient(true);
  }, []);

  const getStorageKey = useCallback((treeId: string) => `lastPageNodeId_${treeId}`, []);

  const getSavedPageNodeId = useCallback(
    (treeId: string): string | null => {
      if (!isClient) return null;
      try {
        return localStorage.getItem(getStorageKey(treeId));
      } catch {
        return null;
      }
    },
    [isClient, getStorageKey]
  );

  const savePageNodeId = useCallback(
    (treeId: string, pageNodeId: string) => {
      if (!isClient) return;
      try {
        localStorage.setItem(getStorageKey(treeId), pageNodeId);
      } catch {
        /* ignore */
      }
    },
    [isClient, getStorageKey]
  );

  const handleTreeSelect = useCallback(
    (treeId: string) => {
      const savedPageNodeId = getSavedPageNodeId(treeId) || '';
      const path = savedPageNodeId ? `/d/${treeId}/${savedPageNodeId}` : `/d/${treeId}`;
      navigate({ to: path });
    },
    [getSavedPageNodeId, navigate]
  );

  const handleNavigateToInfo = useCallback(() => {
    navigate({ to: '/info' });
  }, [navigate]);

  const handleNavigateToPluginLoaders = useCallback(() => {
    navigate({ to: '/plugin-loaders' });
  }, [navigate]);

  const githubHref = useMemo(() => appHomepage ?? null, [appHomepage]);

  return {
    appDescription,
    appTitle,
    githubHref,
    handleNavigateToInfo,
    handleNavigateToPluginLoaders,
    handleTreeSelect,
    isTourOpen,
    isUserMenuReady,
    setIsTourOpen,
    getSavedPageNodeId,
    savePageNodeId,
  };
}
