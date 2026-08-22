import { useEffect, useMemo, useRef, useState } from 'react';
import type { MapLibreMapInstance } from '~/types/maplibre-public';

export const useMapLayerRuntime = ({
  mapInstance,
  fitSelectionEnabled,
  mapInstanceRef,
}: {
  mapInstance: MapLibreMapInstance | null;
  fitSelectionEnabled: boolean;
  mapInstanceRef?: { current: MapLibreMapInstance | null };
}) => {
  const [mapControlContainer, setMapControlContainer] = useState<HTMLElement | null>(null);
  const [fitControlContainer, setFitControlContainer] = useState<HTMLElement | null>(null);
  const [floatingInteractionActive, setFloatingInteractionActive] = useState(false);
  const canvasPointerEventsRef = useRef<string | null>(null);
  const containerPointerEventsRef = useRef<string | null>(null);

  useEffect(() => {
    if (!mapInstance) return;
    const container = mapInstance.getContainer().querySelector('.maplibregl-ctrl-top-right');
    setMapControlContainer(container instanceof HTMLElement ? container : null);
  }, [mapInstance]);

  useEffect(() => {
    if (!mapInstance) return;
    if (mapInstanceRef) {
      mapInstanceRef.current = mapInstance;
    }
  }, [mapInstance, mapInstanceRef]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const body = document.body;
    if (!body) return undefined;
    const updateState = () => {
      setFloatingInteractionActive(
        document.body?.dataset?.hdbFloatingWindowInteraction ? true : false
      );
    };
    updateState();
    const observer = new MutationObserver(() => updateState());
    observer.observe(body, {
      attributes: true,
      attributeFilter: ['data-hdb-floating-window-interaction'],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!mapInstance) return;
    const container = mapInstance.getContainer();
    const canvas = mapInstance.getCanvas();
    if (floatingInteractionActive) {
      if (canvasPointerEventsRef.current === null) {
        canvasPointerEventsRef.current = canvas.style.pointerEvents;
      }
      if (containerPointerEventsRef.current === null) {
        containerPointerEventsRef.current = container.style.pointerEvents;
      }
      container.style.pointerEvents = 'none';
      canvas.style.pointerEvents = 'none';
    } else if (canvasPointerEventsRef.current !== null) {
      container.style.pointerEvents = containerPointerEventsRef.current ?? '';
      containerPointerEventsRef.current = null;
      canvas.style.pointerEvents = canvasPointerEventsRef.current ?? '';
      canvasPointerEventsRef.current = null;
    }
    return () => {
      if (containerPointerEventsRef.current !== null) {
        container.style.pointerEvents = containerPointerEventsRef.current;
        containerPointerEventsRef.current = null;
      }
      if (canvasPointerEventsRef.current !== null) {
        canvas.style.pointerEvents = canvasPointerEventsRef.current;
        canvasPointerEventsRef.current = null;
      }
    };
  }, [floatingInteractionActive, mapInstance]);

  useEffect(() => {
    if (!fitSelectionEnabled || !mapControlContainer) {
      if (fitControlContainer?.parentNode) {
        fitControlContainer.parentNode.removeChild(fitControlContainer);
      }
      setFitControlContainer(null);
      return;
    }
    if (!fitControlContainer) {
      const container = document.createElement('div');
      container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
      setFitControlContainer(container);
      return;
    }
    const insertContainer = () => {
      const navControl = mapControlContainer.querySelector('.maplibregl-ctrl-group');
      if (navControl && navControl.nextSibling !== fitControlContainer) {
        mapControlContainer.insertBefore(fitControlContainer, navControl.nextSibling);
        return;
      }
      if (!navControl && mapControlContainer.lastChild !== fitControlContainer) {
        mapControlContainer.appendChild(fitControlContainer);
      }
    };
    insertContainer();
    const frame = window.requestAnimationFrame(insertContainer);
    return () => window.cancelAnimationFrame(frame);
  }, [fitSelectionEnabled, mapControlContainer, fitControlContainer]);

  return useMemo(
    () => ({
      mapControlContainer,
      fitControlContainer,
      floatingInteractionActive,
      setFloatingInteractionActive,
    }),
    [fitControlContainer, floatingInteractionActive, mapControlContainer]
  );
};
