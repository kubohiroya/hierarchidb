import * as React from 'react';
import { AuthProviderOption } from './AuthProviderOption';
import { GitHub as GitHubIcon, Google as GoogleIcon } from '@mui/icons-material';
import { MicrosoftIcon } from './MicrosoftIcon';

export const AuthProviderOptions: AuthProviderOption[] = [
  {
    type: 'google',
    name: 'Google',
    icon: React.createElement(GoogleIcon),
    color: '#4285F4',
    available: true,
  },
  {
    type: 'microsoft',
    name: 'Microsoft',
    icon: React.createElement(MicrosoftIcon),
    color: '#00BCF2',
    available: false,
  },
  {
    type: 'github',
    name: 'GitHub',
    icon: React.createElement(GitHubIcon),
    color: '#333333',
    available: true,
  },
];
