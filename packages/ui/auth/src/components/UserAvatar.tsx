/**
 * @file UserAvatar.tsx
 * @description Robust user avatar component with multiple fallback mechanisms
 */

import { Person as PersonIcon } from '@mui/icons-material';
import { Avatar, Box } from '@mui/material';
import Gravatar from 'react-gravatar';
import { useUserAvatarView } from './useUserAvatarView.js';

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
  const {
    imageUrl,
    shouldShowGoogleImage,
    shouldShowGravatar,
    shouldShowInitials,
    userInitials,
    initialsBackgroundColor,
    handleGoogleImageError,
    handleGoogleImageLoad,
    handleGravatarError,
  } = useUserAvatarView({ pictureUrl, email, name });

  const avatarSize = { width: size, height: size };

  // Google profile picture (first choice)
  if (shouldShowGoogleImage) {
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
          onLoad={handleGoogleImageLoad}
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
