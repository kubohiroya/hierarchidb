/**
 * @file UserAvatar.tsx
 * @description Robust user avatar component with multiple fallback mechanisms
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Avatar, Box } from '@mui/material';
import { Person as PersonIcon } from '@mui/icons-material';
import Gravatar from 'react-gravatar';
import { preloadImage, getGoogleImageVariants } from './imageUtils';

interface UserAvatarProps {
  /** User's profile picture URL (potentially unreliable) */
  pictureUrl?: string;
  /** User's email for Gravatar fallback */
  email?: string;
  /** User's name for generating initials */
  name?: string;
  /** Avatar size in pixels */
  size?: number;
  /** Additional CSS styles */
  sx?: object;
}

/**
 * Robust user avatar component with multiple fallback levels:
 * 1. Google profile picture (with error handling)
 * 2. Gravatar based on email
 * 3. User initials from name
 * 4. Generic person icon
 */
export const UserAvatar: React.FC<UserAvatarProps> = ({
  pictureUrl,
  email,
  name,
  size = 40,
  sx,
}) => {
  const [googleImageFailed, setGoogleImageFailed] = useState(false);
  const [gravatarFailed, setGravatarFailed] = useState(false);
  const [workingGoogleUrl, setWorkingGoogleUrl] = useState<string | null>(null);

  // Test Google image variants and find a working one
  useEffect(() => {
    if (!pictureUrl || !pictureUrl.includes('googleusercontent.com')) {
      return;
    }

    const testGoogleVariants = async () => {
      // 【エラー処理】: バリアント取得失敗時の対応 🟢
      // 【テスト対応】: モックで空配列が返された場合のUnhandled Rejection回避
      const variants = getGoogleImageVariants(pictureUrl);

      if (!variants || !Array.isArray(variants) || variants.length === 0) {
        // 【フォールバック処理】: バリアントが無効な場合は即座に失敗とマーク
        setGoogleImageFailed(true);
        return;
      }

      for (const variant of variants) {
        const success = await preloadImage(variant);
        if (success) {
          setWorkingGoogleUrl(variant);
          setGoogleImageFailed(false);
          return;
        }
      }

      // If all variants fail, mark as failed
      setGoogleImageFailed(true);
    };

    testGoogleVariants();
  }, [pictureUrl]);

  // Generate user initials from name
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

  // Handle Google image loading errors
  const handleGoogleImageError = useCallback(() => {
    setGoogleImageFailed(true);
  }, []);

  // Handle Gravatar loading errors
  const handleGravatarError = useCallback(() => {
    setGravatarFailed(true);
  }, []);

  // Check if we should show Google profile picture
  const shouldShowGoogleImage = (workingGoogleUrl || pictureUrl) && !googleImageFailed;

  // Check if we should show Gravatar
  const shouldShowGravatar = email && !shouldShowGoogleImage && !gravatarFailed;

  // Check if we should show initials
  const shouldShowInitials = userInitials && !shouldShowGoogleImage && !shouldShowGravatar;

  // Generate background color for initials based on name
  const initialsBackgroundColor = useMemo(() => {
    if (!name) return '#9e9e9e';

    // Generate a consistent color based on name hash
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Generate a pleasant color from the hash
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

    return colors[Math.abs(hash) % colors.length];
  }, [name]);

  const avatarSize = { width: size, height: size };

  // Google profile picture (first choice)
  if (shouldShowGoogleImage) {
    const imageUrl = workingGoogleUrl || pictureUrl;
    return (
      <Box sx={{ ...avatarSize, ...sx }}>
        <img
          src={imageUrl}
          alt={name || 'User'}
          style={{
            ...avatarSize,
            borderRadius: '50%',
            objectFit: 'cover',
          }}
          onError={handleGoogleImageError}
          onLoad={() => {
            // Reset failed state if image loads successfully
            if (googleImageFailed) {
              setGoogleImageFailed(false);
            }
          }}
          crossOrigin="anonymous"
          loading="lazy"
        />
      </Box>
    );
  }

  // Gravatar (second choice)
  if (shouldShowGravatar) {
    return (
      <Box sx={{ ...avatarSize, ...sx }}>
        <Gravatar
          email={email}
          size={size}
          style={{ borderRadius: '50%' }}
          default="404" // This will cause 404 if no Gravatar exists, triggering onError
          onError={handleGravatarError}
        />
      </Box>
    );
  }

  // User initials (third choice)
  if (shouldShowInitials) {
    return (
      <Avatar
        sx={{
          ...avatarSize,
          backgroundColor: initialsBackgroundColor,
          color: 'white',
          fontWeight: 600,
          fontSize: size * 0.4, // Adjust font size based on avatar size
          ...sx,
        }}
      >
        {userInitials}
      </Avatar>
    );
  }

  // Generic person icon (final fallback)
  return (
    <Avatar
      sx={{
        ...avatarSize,
        backgroundColor: '#9e9e9e',
        color: 'white',
        ...sx,
      }}
    >
      <PersonIcon sx={{ fontSize: size * 0.6 }} />
    </Avatar>
  );
};
