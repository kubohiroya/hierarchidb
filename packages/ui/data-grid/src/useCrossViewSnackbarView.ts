import { useEffect, useMemo, useState } from 'react';
import { CrossViewStyles } from './CrossViewStyles.js';

type CrossViewEvent = {
  source: 'row' | 'features';
  id: string | number;
  data?: any;
};

type CrossViewContent = {
  title?: string;
  message?: string;
};

type UseCrossViewSnackbarViewArgs = {
  datasetId: string;
  format?: (ev: CrossViewEvent) => CrossViewContent;
};

const resolveContent = (payload: CrossViewEvent | null, format?: (ev: CrossViewEvent) => CrossViewContent): CrossViewContent => {
  if (!payload) return { title: undefined, message: undefined };
  if (format) return format(payload);

  const name = payload.data?.name ?? payload.id;
  const type = payload.data?.type ?? payload.data?.nodeType;
  const description = payload.data?.description;
  const coordinates = payload.data?.coordinates || payload.data?.point || payload.data?.center;
  const coordinateText = Array.isArray(coordinates) ? `(${coordinates[0]}, ${coordinates[1]})` : undefined;

  return {
    title: `[${payload.source}] ${type ?? ''}`.trim(),
    message: [name, description, coordinateText].filter(Boolean).join(' / '),
  };
};

export const useCrossViewSnackbarView = ({
  datasetId,
  format,
}: UseCrossViewSnackbarViewArgs) => {
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<CrossViewEvent | null>(null);

  useEffect(() => {
    const unsub = CrossViewStyles.subscribeFocus(datasetId, (event) => {
      if (event) {
        setPayload({ source: event.source, id: event.id, data: event.data });
        setOpen(true);
      } else {
        setOpen(false);
      }
    });

    return () => {
      try {
        unsub();
      } catch (error) {
        console.warn('[CrossViewSnackbar]', 'Failed to unsubscribe focus listener', error);
      }
    };
  }, [datasetId]);

  const content = useMemo(() => resolveContent(payload, format), [format, payload]);

  return {
    open,
    setOpen,
    content,
  };
};
