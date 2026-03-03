import { useCallback, useEffect, useMemo, useState } from 'react';

const preloadImage = (url: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
};

const getGoogleImageVariants = (url: string): string[] => {
  const baseUrl = url.split('=')[0];
  return [
    `${baseUrl}=s96-c`,
    `${baseUrl}=s64-c`,
    `${baseUrl}=s32-c`,
    url,
  ];
};

interface UseUserAvatarViewArgs {
  pictureUrl?: string;
  email?: string;
  name?: string;
}

interface UseUserAvatarViewResult {
  googleImageFailed: boolean;
  imageUrl: string | undefined;
  shouldShowGoogleImage: boolean;
  shouldShowGravatar: boolean;
  shouldShowInitials: boolean;
  userInitials: string;
  initialsBackgroundColor: string;
  handleGoogleImageError: () => void;
  handleGoogleImageLoad: () => void;
  handleGravatarError: () => void;
}

export const useUserAvatarView = ({
  pictureUrl,
  email,
  name,
}: UseUserAvatarViewArgs): UseUserAvatarViewResult => {
  const gravatarOverrideEnabled = useMemo(
    () => String(import.meta.env.VITE_GRAVATAR_OVERRIDE || '').toLowerCase() === 'true',
    [],
  );
  const [googleImageFailed, setGoogleImageFailed] = useState(false);
  const [gravatarFailed, setGravatarFailed] = useState(false);
  const [workingGoogleUrl, setWorkingGoogleUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!pictureUrl || !pictureUrl.includes('googleusercontent.com')) {
      return;
    }

    const testGoogleVariants = async () => {
      const variants = getGoogleImageVariants(pictureUrl);
      for (const variant of variants) {
        const success = await preloadImage(variant);
        if (success) {
          setWorkingGoogleUrl(variant);
          setGoogleImageFailed(false);
          return;
        }
      }
      setGoogleImageFailed(true);
    };

    void testGoogleVariants();
  }, [pictureUrl]);

  const userInitials = useMemo(() => {
    if (!name) return '';

    const nameParts = name.trim().split(/\s+/);
    if (nameParts.length === 1) {
      return nameParts[0]?.substring(0, 2).toUpperCase() || '';
    }

    const firstChar = nameParts[0]?.[0] || '';
    const lastChar = nameParts[nameParts.length - 1]?.[0] || '';
    return (firstChar + lastChar).toUpperCase();
  }, [name]);

  const handleGoogleImageError = useCallback(() => {
    setGoogleImageFailed(true);
  }, []);

  const handleGoogleImageLoad = useCallback(() => {
    setGoogleImageFailed(false);
  }, []);

  const handleGravatarError = useCallback(() => {
    setGravatarFailed(true);
  }, []);

  const imageUrl = workingGoogleUrl ?? pictureUrl ?? undefined;
  const shouldShowGoogleImage = !gravatarOverrideEnabled && Boolean(imageUrl) && !googleImageFailed;
  const shouldShowGravatar = gravatarOverrideEnabled && Boolean(email) && !gravatarFailed;
  const shouldShowInitials = Boolean(userInitials) && !shouldShowGoogleImage && !shouldShowGravatar;

  const initialsBackgroundColor = useMemo(() => {
    if (!name) return '#9e9e9e';

    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    const colors = [
      '#f44336',
      '#e91e63',
      '#9c27b0',
      '#673ab7',
      '#3f51b5',
      '#2196f3',
      '#03a9f4',
      '#00bcd4',
      '#009688',
      '#4caf50',
      '#8bc34a',
      '#cddc39',
      '#ffc107',
      '#ff9800',
      '#ff5722',
      '#795548',
    ];

    return colors[Math.abs(hash) % colors.length] ?? '#9e9e9e';
  }, [name]);

  return {
    googleImageFailed,
    imageUrl,
    shouldShowGoogleImage,
    shouldShowGravatar,
    shouldShowInitials,
    userInitials,
    initialsBackgroundColor,
    handleGoogleImageError,
    handleGoogleImageLoad,
    handleGravatarError,
  };
};
